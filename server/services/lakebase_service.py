"""Lakebase Provisioned service for marketplace analytics queries."""

import time
import uuid
from contextlib import contextmanager
from typing import Any

import psycopg2
from psycopg2 import pool
from databricks.sdk import WorkspaceClient

from server.config import get_settings
from server.exceptions import DatabaseConnectionError, DatabaseQueryError

# Load settings
settings = get_settings()

# Token cache (refresh interval from settings)
_token_cache: dict[str, Any] = {"token": None, "expires_at": 0}

# Connection pool (lazy initialization)
_connection_pool: pool.ThreadedConnectionPool | None = None
_pool_config: dict[str, Any] | None = None


class LakebaseService:
    """Service for querying Lakebase Provisioned database."""

    def __init__(self):
        """Initialize the Lakebase service."""
        self.schema = settings.lakebase_schema
        self.instance_name = settings.lakebase_instance_name

    def _get_workspace_client(self) -> WorkspaceClient:
        """Get Databricks WorkspaceClient."""
        return WorkspaceClient()

    def _get_fresh_token(self) -> str:
        """Generate a fresh OAuth token for Lakebase."""
        global _token_cache

        now = time.time()
        if _token_cache["token"] and now < _token_cache["expires_at"]:
            return _token_cache["token"]

        w = self._get_workspace_client()
        cred = w.database.generate_database_credential(
            request_id=str(uuid.uuid4()),
            instance_names=[self.instance_name]
        )

        _token_cache["token"] = cred.token
        _token_cache["expires_at"] = now + settings.token_refresh_interval

        return cred.token

    def _get_connection_pool(self) -> pool.ThreadedConnectionPool:
        """Get or create a connection pool."""
        global _connection_pool, _pool_config

        w = self._get_workspace_client()
        instance = w.database.get_database_instance(name=self.instance_name)
        current_user = w.current_user.me()
        username = current_user.user_name

        # Create pool if it doesn't exist
        if _connection_pool is None:
            _pool_config = {
                "host": instance.read_write_dns,
                "port": 5432,
                "dbname": "databricks_postgres",
                "user": username,
                "sslmode": "require"
            }
            _connection_pool = pool.ThreadedConnectionPool(
                minconn=settings.pool_min_connections,
                maxconn=settings.pool_max_connections,
                **_pool_config,
                password=self._get_fresh_token()
            )

        return _connection_pool

    def _reset_pool(self):
        """Reset connection pool to force fresh token on next connection."""
        global _connection_pool, _token_cache
        if _connection_pool is not None:
            try:
                _connection_pool.closeall()
            except Exception:
                pass  # Pool might already be in bad state
            _connection_pool = None
        _token_cache = {"token": None, "expires_at": 0}

    @contextmanager
    def get_connection(self):
        """Context manager for database connections with automatic token refresh."""
        try:
            conn_pool = self._get_connection_pool()
            conn = conn_pool.getconn()
            try:
                # Test the connection is still valid
                conn.cursor().execute("SELECT 1")
                yield conn
            finally:
                conn_pool.putconn(conn)
        except psycopg2.OperationalError as e:
            # Token expired or connection failed - reset pool and retry
            self._reset_pool()
            try:
                conn_pool = self._get_connection_pool()
                conn = conn_pool.getconn()
                try:
                    yield conn
                finally:
                    conn_pool.putconn(conn)
            except psycopg2.OperationalError as retry_error:
                raise DatabaseConnectionError(detail=str(retry_error))

    def execute_query(self, sql: str, params: tuple | None = None) -> list[dict]:
        """Execute a query and return results as list of dicts."""
        try:
            with self.get_connection() as conn:
                with conn.cursor() as cur:
                    # Replace {schema} placeholder with actual schema name
                    formatted_sql = sql.format(schema=self.schema)
                    cur.execute(formatted_sql, params)
                    columns = [desc[0] for desc in cur.description]
                    rows = cur.fetchall()
                    return [dict(zip(columns, row)) for row in rows]
        except DatabaseConnectionError:
            raise  # Re-raise our custom exceptions
        except psycopg2.ProgrammingError as e:
            raise DatabaseQueryError(detail=str(e))
        except psycopg2.Error as e:
            raise DatabaseQueryError(detail=str(e))

    # =========================================================================
    # Analytics Query Methods
    # =========================================================================

    def get_cities(self) -> list[str]:
        """Get list of all cities."""
        rows = self.execute_query("""
            SELECT DISTINCT city
            FROM {schema}.city_investment
            ORDER BY city
        """)
        return [row["city"] for row in rows]

    def get_city_investment(self) -> list[dict]:
        """Get city investment matrix data."""
        return self.execute_query("""
            SELECT
                city,
                total_viewers AS demand,
                conversion_rate AS conversion,
                estimated_revenue AS revenue,
                quadrant
            FROM {schema}.city_investment
            ORDER BY estimated_revenue DESC
        """)

    def get_city_funnel(self, city: str | None = None, days: int = 90) -> dict:
        """Get conversion funnel data, optionally filtered by city.

        Uses the max event_date in the table as reference point for date filtering
        (handles historical datasets that may not have recent data).
        """
        if city and city.lower() != "all":
            rows = self.execute_query("""
                SELECT
                    SUM(viewers) AS viewers,
                    SUM(initiated_bookers) AS bookers,
                    SUM(completers) AS completed
                FROM {schema}.city_funnel
                WHERE city = %s
                  AND event_date >= (SELECT MAX(event_date) FROM {schema}.city_funnel) - INTERVAL '%s days'
            """, (city, days))
        else:
            rows = self.execute_query("""
                SELECT
                    SUM(viewers) AS viewers,
                    SUM(initiated_bookers) AS bookers,
                    SUM(completers) AS completed
                FROM {schema}.city_funnel
                WHERE event_date >= (SELECT MAX(event_date) FROM {schema}.city_funnel) - INTERVAL '%s days'
            """, (days,))

        row = rows[0] if rows else {"viewers": 0, "bookers": 0, "completed": 0}
        return {
            "city": city or "All Cities",
            "days": days,
            "funnel": {
                "viewers": int(row["viewers"] or 0),
                "bookers": int(row["bookers"] or 0),
                "completed": int(row["completed"] or 0)
            }
        }

    def get_properties(self, city: str | None = None) -> dict:
        """Get property performance data with city averages and bucket categorization.

        Returns all properties for the city (or all cities) with:
        - Key performance metrics only (optimized for performance)
        - City averages for color coding
        - Bucket category (promote/intervention/at_risk) based on city averages
        """
        # Base query - only fetch columns needed for display and bucketing
        base_query = """
            SELECT
                property_id AS id,
                property_name AS name,
                city,
                property_type,
                unique_viewers AS views,
                initiated_bookings AS bookings,
                initiation_rate,
                completion_rate,
                cancel_rate,
                payment_fail_rate,
                avg_review_rating,
                total_revenue AS revenue
            FROM {schema}.property_performance
        """

        if city and city.lower() != "all":
            rows = self.execute_query(
                base_query + " WHERE city = %s ORDER BY unique_viewers DESC",
                (city,)
            )
        else:
            rows = self.execute_query(
                base_query + " ORDER BY unique_viewers DESC"
            )

        if not rows:
            return {"properties": [], "city_averages": {}}

        # Calculate city averages for bucketing and color coding
        city_data: dict[str, list[dict]] = {}
        for row in rows:
            c = row["city"]
            if c not in city_data:
                city_data[c] = []
            city_data[c].append(row)

        # Calculate averages per city (only metrics needed for bucketing/display)
        city_averages: dict[str, dict] = {}
        for c, props in city_data.items():
            n = len(props)
            city_averages[c] = {
                "avg_views": sum(p["views"] or 0 for p in props) / n,
                "avg_initiation_rate": sum(p["initiation_rate"] or 0 for p in props) / n,
                "property_count": n,
            }

        # Assign bucket category to each property based on city averages
        for row in rows:
            c = row["city"]
            avg = city_averages[c]
            views = row["views"] or 0
            init_rate = row["initiation_rate"] or 0

            if init_rate > avg["avg_initiation_rate"]:
                row["bucket"] = "promote"
            elif views > avg["avg_views"]:
                row["bucket"] = "intervention"
            else:
                row["bucket"] = "at_risk"

        return {
            "properties": rows,
            "city_averages": city_averages if city and city.lower() != "all" else {},
        }

    def get_amenities(self, city: str | None = None, property_type: str | None = None) -> list[dict]:
        """Get amenity lift data."""
        conditions = []
        params = []

        if city and city.lower() != "all":
            conditions.append("city = %s")
            params.append(city)

        if property_type and property_type.lower() != "all":
            conditions.append("property_type = %s")
            params.append(property_type)

        where_clause = "WHERE " + " AND ".join(conditions) if conditions else ""

        return self.execute_query(f"""
            SELECT
                amenity_name AS name,
                confirmation_lift AS lift,
                impact_tier
            FROM {{schema}}.amenity_lift
            {where_clause}
            ORDER BY confirmation_lift DESC
        """, tuple(params) if params else None)

    def get_top_amenities_by_city(self) -> list[dict]:
        """Get top 3 amenities per city."""
        return self.execute_query("""
            SELECT
                city,
                property_type,
                amenity_name,
                confirmation_lift AS lift,
                rank
            FROM {schema}.amenity_city_top
            ORDER BY city, rank
        """)

    def get_device_metrics(self, city: str | None = None, weeks: int = 6) -> dict:
        """Get device-segmented funnel and trends.

        Uses the max week_start in the table as reference point for date filtering
        (handles historical datasets that may not have recent data).
        """
        city_filter = ""
        params: tuple = (weeks,)

        if city and city.lower() != "all":
            city_filter = "AND city = %s"
            params = (weeks, city)

        # Device funnel totals
        funnel_rows = self.execute_query(f"""
            SELECT
                device,
                SUM(viewers) AS viewers,
                SUM(initiated_bookers) AS bookers,
                SUM(completers) AS completed
            FROM {{schema}}.device_funnel
            WHERE week_start >= (SELECT MAX(week_start) FROM {{schema}}.device_funnel) - INTERVAL '%s weeks'
            {city_filter}
            GROUP BY device
        """, params)

        device_funnel = {}
        for row in funnel_rows:
            device_funnel[row["device"]] = {
                "viewers": int(row["viewers"] or 0),
                "bookers": int(row["bookers"] or 0),
                "completed": int(row["completed"] or 0)
            }

        # Weekly trends
        trend_rows = self.execute_query(f"""
            SELECT
                DATE_TRUNC('week', week_start) AS week,
                device,
                AVG(completion_rate) AS rate
            FROM {{schema}}.device_funnel
            WHERE week_start >= (SELECT MAX(week_start) FROM {{schema}}.device_funnel) - INTERVAL '%s weeks'
            {city_filter}
            GROUP BY DATE_TRUNC('week', week_start), device
            ORDER BY week
        """, params)

        # Transform to weekly trend format
        weekly_data: dict[str, dict] = {}
        for row in trend_rows:
            week_str = row["week"].strftime("W%V") if row["week"] else "Unknown"
            if week_str not in weekly_data:
                weekly_data[week_str] = {"week": week_str}
            weekly_data[week_str][row["device"]] = float(row["rate"] or 0)

        weekly_trends = list(weekly_data.values())

        # Device diagnosis
        if city and city.lower() != "all":
            diagnosis_rows = self.execute_query("""
                SELECT
                    desktop_rate,
                    mobile_rate,
                    tablet_rate,
                    device_gap_pct AS device_gap,
                    diagnosis,
                    mobile_trend
                FROM {schema}.device_diagnosis
                WHERE city = %s
            """, (city,))
        else:
            # Aggregate diagnosis across all cities
            diagnosis_rows = self.execute_query("""
                SELECT
                    AVG(desktop_rate) AS desktop_rate,
                    AVG(mobile_rate) AS mobile_rate,
                    AVG(tablet_rate) AS tablet_rate,
                    AVG(device_gap_pct) AS device_gap,
                    MODE() WITHIN GROUP (ORDER BY diagnosis) AS diagnosis,
                    MODE() WITHIN GROUP (ORDER BY mobile_trend) AS mobile_trend
                FROM {schema}.device_diagnosis
            """)

        diagnosis = diagnosis_rows[0] if diagnosis_rows else {}

        return {
            "city": city or "All Cities",
            "deviceFunnel": device_funnel,
            "weeklyTrends": weekly_trends,
            "diagnosis": {
                "desktopRate": float(diagnosis.get("desktop_rate") or 0),
                "mobileRate": float(diagnosis.get("mobile_rate") or 0),
                "tabletRate": float(diagnosis.get("tablet_rate") or 0),
                "deviceGap": float(diagnosis.get("device_gap") or 0),
                "diagnosis": diagnosis.get("diagnosis", "unknown"),
                "mobileTrend": diagnosis.get("mobile_trend", "unknown")
            }
        }

    def get_property_types(self) -> list[str]:
        """Get list of distinct property types."""
        rows = self.execute_query("""
            SELECT DISTINCT property_type
            FROM {schema}.property_performance
            WHERE property_type IS NOT NULL
            ORDER BY property_type
        """)
        return [row["property_type"] for row in rows]
