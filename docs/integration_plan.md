# Data Integration Plan

## Overview

This document outlines the plan to replace hardcoded dashboard data with real data from Lakebase Provisioned.

**Data Source:** Synced tables in Lakebase (PostgreSQL) — continuously synchronized from `serverless_dbdkzc_catalog.default`

**Connection Method:** psycopg2 with Databricks OAuth authentication

---

## Lakebase Connection Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Unity Catalog (Source)                        │
│           serverless_dbdkzc_catalog.default                     │
│                                                                  │
│   gold_city_investment  │  gold_city_funnel                     │
│   gold_property_performance  │  gold_amenity_lift               │
│   gold_amenity_city_top  │  gold_device_funnel                  │
│   gold_device_diagnosis                                          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ Continuous Sync (~15 seconds)
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│              Lakebase Provisioned Instance                       │
│   Instance: <INSTANCE_NAME>                                      │
│   Database: databricks_postgres                                  │
│   Schema: <SCHEMA_NAME> (e.g., "analytics" or "public")         │
│                                                                  │
│   Synced Tables (read-only PostgreSQL):                         │
│   • city_investment       • city_funnel                         │
│   • property_performance  • amenity_lift                        │
│   • amenity_city_top      • device_funnel                       │
│   • device_diagnosis                                             │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ psycopg2 + OAuth Token
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    FastAPI Application                           │
│              marketplace-intelligence                            │
│                                                                  │
│   LakebaseService (connection pool + token refresh)             │
│              ↓                                                   │
│   Analytics Router (/api/cities, /api/properties, etc.)         │
└─────────────────────────────────────────────────────────────────┘
```

---

## Lakebase Authentication

### How OAuth Works

1. **Generate Token:** Call `w.database.generate_database_credential()` with instance name
2. **Token Lifetime:** ~1 hour (must refresh for long-running connections)
3. **User Identity:** Databricks user email or service principal client ID

### Connection Code Pattern

```python
from databricks.sdk import WorkspaceClient
import psycopg2
import uuid

w = WorkspaceClient()

INSTANCE_NAME = "<YOUR_INSTANCE_NAME>"  # e.g., "marketplace-db"
SCHEMA_NAME = "<YOUR_SCHEMA_NAME>"      # e.g., "analytics" or "public"

def get_lakebase_connection():
    """Get a PostgreSQL connection with fresh OAuth credentials."""
    # Get instance endpoint
    instance = w.database.get_database_instance(name=INSTANCE_NAME)

    # Generate fresh OAuth token
    cred = w.database.generate_database_credential(
        request_id=str(uuid.uuid4()),
        instance_names=[INSTANCE_NAME]
    )

    # Connect using psycopg2
    return psycopg2.connect(
        host=instance.read_write_dns,
        port=5432,
        dbname="databricks_postgres",
        user=w.config.username or w.config.client_id,  # email or SP client ID
        password=cred.token,
        sslmode="require"
    )
```

### Environment Configuration

Add to `.env.local`:
```bash
# Lakebase Configuration
LAKEBASE_INSTANCE_NAME=<YOUR_INSTANCE_NAME>
LAKEBASE_SCHEMA=<YOUR_SCHEMA_NAME>
```

---

## Current Hardcoded Data Structures

| # | Data Structure | Used In | Description |
|---|----------------|---------|-------------|
| 1 | `CITIES` | All tabs | List of city names for dropdowns |
| 2 | `funnelBase` | Overview Tab | City-level funnel (viewers → bookers → completed) |
| 3 | `cityInvestment` | Overview Tab | Investment matrix (demand, conversion, revenue, quadrant) |
| 4 | `propertyData` | Property Tab | Property performance metrics |
| 5 | `amenityData` | Amenity Tab | Amenity lift by city & property type |
| 6 | `amenitiesList` | Amenity Tab | List of amenity names |
| 7 | `deviceFunnel` | Demand Tab | Device-segmented funnel totals |
| 8 | `weeklyTrends` | Demand Tab | Weekly conversion rates by device |

---

## Database Tables Mapping

| Hardcoded Data | Database Table | Direct Match? |
|----------------|----------------|---------------|
| `CITIES` | `gold_city_investment` | ✅ Yes |
| `funnelBase` | `gold_city_funnel` | ⚠️ Needs aggregation |
| `cityInvestment` | `gold_city_investment` | ✅ Yes |
| `propertyData` | `gold_property_performance` | ✅ Yes |
| `amenityData` | `gold_amenity_lift` | ✅ Yes |
| `amenitiesList` | `gold_amenity_lift` | ✅ Yes (DISTINCT) |
| `deviceFunnel` | `gold_device_funnel` | ⚠️ Needs aggregation |
| `weeklyTrends` | `gold_device_funnel` | ⚠️ Needs transformation |
| (new) Device diagnosis | `gold_device_diagnosis` | ✅ Yes |

---

## API Endpoints Design

### Principle: Minimize API Calls, Maximize Reuse

We'll create **6 backend endpoints** that can be filtered/parameterized to serve all dashboard needs.

---

### Endpoint 1: `/api/cities`

**Purpose:** Populate city dropdown across all tabs

**Query (PostgreSQL):**
```sql
SELECT DISTINCT city
FROM {schema}.city_investment
ORDER BY city
```

**Note:** `{schema}` = your Lakebase schema name (e.g., `analytics` or `public`)

**Response:**
```json
{
  "cities": ["Abu Dhabi", "Agra", "Amalfi", ...]
}
```

**Used By:** All tabs (city filter dropdown)

---

### Endpoint 2: `/api/city-investment`

**Purpose:** Investment priority matrix data

**Query (PostgreSQL):**
```sql
SELECT
  city,
  total_viewers AS demand,
  conversion_rate::DOUBLE PRECISION AS conversion,
  estimated_revenue AS revenue,
  quadrant
FROM {schema}.city_investment
ORDER BY estimated_revenue DESC
```

**Response:**
```json
{
  "data": [
    {
      "city": "Phuket",
      "demand": 15234,
      "conversion": 15.8,
      "revenue": 959995.19,
      "quadrant": "Protect & Expand"
    },
    ...
  ]
}
```

**Used By:**
- Overview Tab → Investment Priority Matrix
- Overview Tab → Quadrant cards
- Overview Tab → City dropdown for funnel

**Notes:**
- Quadrant is pre-computed in the database
- No date filtering needed (uses all-time aggregates)

---

### Endpoint 3: `/api/city-funnel`

**Purpose:** Conversion funnel data by city

**Query Parameters:**
- `city` (optional): Filter by city, "all" for aggregate
- `date_range` (optional): "last_month", "last_quarter", "last_year"

**Query (All Cities - PostgreSQL):**
```sql
SELECT
  SUM(viewers) AS viewers,
  SUM(initiated_bookers) AS bookers,
  SUM(completers) AS completed
FROM {schema}.city_funnel
WHERE event_date >= %s
```

**Query (Single City - PostgreSQL):**
```sql
SELECT
  SUM(viewers) AS viewers,
  SUM(initiated_bookers) AS bookers,
  SUM(completers) AS completed
FROM {schema}.city_funnel
WHERE city = %s
  AND event_date >= %s
```

**Note:** PostgreSQL uses `%s` for parameter placeholders with psycopg2

**Date Range Calculation:**
| Parameter | Start Date |
|-----------|------------|
| last_month | CURRENT_DATE - INTERVAL 30 DAYS |
| last_quarter | CURRENT_DATE - INTERVAL 90 DAYS |
| last_year | CURRENT_DATE - INTERVAL 365 DAYS |

**Response:**
```json
{
  "city": "All Cities",
  "date_range": "last_quarter",
  "funnel": {
    "viewers": 68500,
    "bookers": 19104,
    "completed": 11592
  }
}
```

**Used By:**
- Overview Tab → Conversion Funnel panel

---

### Endpoint 4: `/api/properties`

**Purpose:** Property performance data

**Query Parameters:**
- `city` (optional): Filter by city
- `limit` (optional): Max results (default 100)

**Query (PostgreSQL):**
```sql
SELECT
  property_id AS id,
  property_name AS name,
  city,
  property_type,
  views,
  completed_bookings AS bookings,
  completion_rate::DOUBLE PRECISION AS conversion,
  payment_fail_rate::DOUBLE PRECISION AS fail_rate,
  total_revenue AS revenue,
  cancel_rate::DOUBLE PRECISION AS cancel_rate,
  performance_category
FROM {schema}.property_performance
WHERE (%s IS NULL OR city = %s)
ORDER BY views DESC
LIMIT %s
```

**Response:**
```json
{
  "city": "All Cities",
  "properties": [
    {
      "id": "9082",
      "name": "Heritage Hotel in Cairo",
      "city": "Cairo",
      "propertyType": "Historical Place",
      "views": 3,
      "bookings": 0,
      "conversion": 0.0,
      "failRate": 0.0,
      "revenue": 0.0,
      "cancelRate": 0.0,
      "performanceCategory": "promote"
    },
    ...
  ]
}
```

**Used By:**
- Property Tab → Scatter chart
- Property Tab → Property cards (grouped by category)
- Property Tab → Properties table

**Notes:**
- `performance_category` maps to: "promote", "intervention", "at_risk"
- Frontend can group by `performanceCategory` for the card sections

---

### Endpoint 5: `/api/amenities`

**Purpose:** Amenity impact data

**Query Parameters:**
- `city` (optional): Filter by city, "all" for aggregate
- `property_type` (optional): Filter by property type

**Query (Amenity Lift - PostgreSQL):**
```sql
SELECT
  amenity_name AS name,
  confirmation_lift::DOUBLE PRECISION AS lift,
  impact_tier
FROM {schema}.amenity_lift
WHERE (%s IS NULL OR %s = 'all' OR city = %s)
  AND (%s IS NULL OR property_type = %s)
ORDER BY confirmation_lift DESC
```

**Query (Top Amenities by City - PostgreSQL):**
```sql
SELECT
  city,
  property_type,
  amenity_name,
  confirmation_lift::DOUBLE PRECISION AS lift,
  rank
FROM {schema}.amenity_city_top
WHERE rank <= 3
ORDER BY city, rank
```

**Response (Lift):**
```json
{
  "city": "Phuket",
  "propertyType": "Summer Getaway",
  "amenities": [
    {"name": "Wi-Fi", "lift": 12.5, "impactTier": "must_have"},
    {"name": "Pool", "lift": 8.2, "impactTier": "differentiator"},
    ...
  ]
}
```

**Response (Top by City):**
```json
{
  "topAmenities": [
    {
      "city": "Abu Dhabi",
      "propertyType": "Urban Year-Round",
      "top3": [
        {"name": "Wine Cellar", "lift": 4.44, "rank": 1},
        {"name": "Fire Pit", "lift": 3.41, "rank": 2},
        {"name": "Terrace", "lift": 2.29, "rank": 3}
      ]
    },
    ...
  ]
}
```

**Used By:**
- Amenity Tab → Bar chart (amenity lift)
- Amenity Tab → Top amenities by city grid

**Notes:**
- `impact_tier` in DB uses: "must_have", "differentiator", "low_impact"
- Frontend maps these to thresholds (>8%, 4-8%, <4%)

---

### Endpoint 6: `/api/device-metrics`

**Purpose:** Device-segmented funnel and trends

**Query Parameters:**
- `city` (optional): Filter by city
- `weeks` (optional): Number of recent weeks (default 6)

**Query (Device Funnel Totals - PostgreSQL):**
```sql
SELECT
  device,
  SUM(viewers) AS viewers,
  SUM(initiated_bookers) AS bookers,
  SUM(completers) AS completed
FROM {schema}.device_funnel
WHERE (%s IS NULL OR %s = 'all' OR city = %s)
GROUP BY device
```

**Query (Weekly Trends - PostgreSQL):**
```sql
SELECT
  DATE_TRUNC('week', week_start) AS week,
  device,
  AVG(completion_rate) AS rate
FROM {schema}.device_funnel
WHERE (%s IS NULL OR %s = 'all' OR city = %s)
  AND week_start >= CURRENT_DATE - INTERVAL '%s weeks'
GROUP BY DATE_TRUNC('week', week_start), device
ORDER BY week
```

**Query (Device Diagnosis - PostgreSQL):**
```sql
SELECT
  city,
  desktop_rate::DOUBLE PRECISION AS desktop_rate,
  mobile_rate::DOUBLE PRECISION AS mobile_rate,
  tablet_rate::DOUBLE PRECISION AS tablet_rate,
  device_gap_pct::DOUBLE PRECISION AS device_gap,
  diagnosis,
  mobile_trend
FROM {schema}.device_diagnosis
WHERE (%s IS NULL OR %s = 'all' OR city = %s)
```

**Response:**
```json
{
  "city": "All Cities",
  "deviceFunnel": {
    "desktop": {"viewers": 28400, "bookers": 8520, "completed": 5964},
    "mobile": {"viewers": 25200, "bookers": 5040, "completed": 2772},
    "tablet": {"viewers": 16900, "bookers": 4394, "completed": 2856}
  },
  "weeklyTrends": [
    {"week": "W1", "desktop": 13.2, "mobile": 9.8, "tablet": 11.5},
    {"week": "W2", "desktop": 12.8, "mobile": 9.4, "tablet": 11.0},
    ...
  ],
  "diagnosis": {
    "deviceGap": 25,
    "diagnosis": "likely_ux_issue",
    "mobileTrend": "improving"
  }
}
```

**Used By:**
- Demand Tab → Device funnel cards
- Demand Tab → Weekly trend line chart
- Demand Tab → Diagnosis banner

---

## Data Type Adaptations

### Property Types Mapping

**Current (Hardcoded):** `house`, `apartment`

**Database:** `Urban Year-Round`, `Summer Getaway`, `Historical Place`, `Ski Resort`

**Decision:** Use database property types directly. Update frontend dropdown to use actual values.

---

### Performance Category Mapping

**Current (Hardcoded):** Calculated on frontend based on thresholds:
- `intervention`: conversion < 5% OR failRate > 15%
- `at_risk`: conversion 5-10% AND failRate <= 15%
- `promote`: conversion >= 10% AND failRate <= 15%

**Database:** Pre-calculated `performance_category` column

**Decision:** Use database values. Values are: `"promote"`, `"intervention"`, `"at_risk"`

---

### Funnel Stages Mapping

**Current (Hardcoded):** 3 stages: `viewers → bookers → completed`

**Database:** 7 stages: `viewers → clickers → searchers → filterers → initiated_bookers → confirmed_bookers → completers`

**Decision:** Use 3-stage simplified funnel for consistency:
- `viewers` = viewers
- `bookers` = initiated_bookers (booking process started)
- `completed` = completers

**Optional Enhancement:** Could expand to show full funnel in future iteration.

---

## Implementation Phases

### Phase 1: Backend API Development

1. Create Lakebase service with connection pooling and token refresh
2. Create FastAPI routers for each endpoint
3. Implement PostgreSQL queries via psycopg2
4. Add response caching (optional, for performance)
5. Add error handling and validation

**Files to create/modify:**
- `server/services/lakebase_service.py` (new) — Connection management
- `server/routers/analytics.py` (new) — API endpoints
- `pyproject.toml` — Ensure `psycopg2-binary` is included

### Lakebase Service Implementation

```python
# server/services/lakebase_service.py

import os
import uuid
import time
from typing import Optional
from contextlib import contextmanager

import psycopg2
from psycopg2 import pool
from databricks.sdk import WorkspaceClient

# Configuration
INSTANCE_NAME = os.getenv("LAKEBASE_INSTANCE_NAME", "marketplace-db")
SCHEMA_NAME = os.getenv("LAKEBASE_SCHEMA", "analytics")

# Token cache (refresh every 15 minutes for safety margin)
_token_cache = {"token": None, "expires_at": 0}
TOKEN_REFRESH_INTERVAL = 900  # 15 minutes

# Connection pool
_connection_pool: Optional[pool.ThreadedConnectionPool] = None


def _get_workspace_client() -> WorkspaceClient:
    """Get Databricks WorkspaceClient."""
    return WorkspaceClient()


def _get_fresh_token() -> str:
    """Generate a fresh OAuth token for Lakebase."""
    global _token_cache

    now = time.time()
    if _token_cache["token"] and now < _token_cache["expires_at"]:
        return _token_cache["token"]

    w = _get_workspace_client()
    cred = w.database.generate_database_credential(
        request_id=str(uuid.uuid4()),
        instance_names=[INSTANCE_NAME]
    )

    _token_cache["token"] = cred.token
    _token_cache["expires_at"] = now + TOKEN_REFRESH_INTERVAL

    return cred.token


def _get_instance_endpoint() -> str:
    """Get the Lakebase instance DNS endpoint."""
    w = _get_workspace_client()
    instance = w.database.get_database_instance(name=INSTANCE_NAME)
    return instance.read_write_dns


def get_connection_pool() -> pool.ThreadedConnectionPool:
    """Get or create a connection pool."""
    global _connection_pool

    if _connection_pool is None:
        w = _get_workspace_client()
        username = w.config.username or w.config.client_id

        _connection_pool = pool.ThreadedConnectionPool(
            minconn=2,
            maxconn=10,
            host=_get_instance_endpoint(),
            port=5432,
            dbname="databricks_postgres",
            user=username,
            password=_get_fresh_token(),
            sslmode="require"
        )

    return _connection_pool


@contextmanager
def get_connection():
    """Context manager for database connections."""
    conn_pool = get_connection_pool()
    conn = conn_pool.getconn()
    try:
        yield conn
    finally:
        conn_pool.putconn(conn)


def execute_query(sql: str, params: tuple = None) -> list[dict]:
    """Execute a query and return results as list of dicts."""
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(sql.format(schema=SCHEMA_NAME), params)
            columns = [desc[0] for desc in cur.description]
            rows = cur.fetchall()
            return [dict(zip(columns, row)) for row in rows]
```

### Analytics Router Example

```python
# server/routers/analytics.py

from fastapi import APIRouter, Query, HTTPException
from typing import Optional
from pydantic import BaseModel

from ..services.lakebase_service import execute_query, SCHEMA_NAME

router = APIRouter(prefix="/api", tags=["analytics"])


class CityInvestment(BaseModel):
    city: str
    demand: int
    conversion: float
    revenue: float
    quadrant: str


class CityInvestmentResponse(BaseModel):
    data: list[CityInvestment]


@router.get("/cities")
async def get_cities():
    """Get list of all cities for dropdowns."""
    try:
        rows = execute_query("""
            SELECT DISTINCT city
            FROM {schema}.city_investment
            ORDER BY city
        """)
        return {"cities": [row["city"] for row in rows]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/city-investment", response_model=CityInvestmentResponse)
async def get_city_investment():
    """Get city investment matrix data."""
    try:
        rows = execute_query("""
            SELECT
                city,
                total_viewers AS demand,
                conversion_rate::DOUBLE PRECISION AS conversion,
                estimated_revenue AS revenue,
                quadrant
            FROM {schema}.city_investment
            ORDER BY estimated_revenue DESC
        """)
        return {"data": rows}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/properties")
async def get_properties(
    city: Optional[str] = Query(None, description="Filter by city"),
    limit: int = Query(100, ge=1, le=1000, description="Max results")
):
    """Get property performance data."""
    try:
        rows = execute_query("""
            SELECT
                property_id AS id,
                property_name AS name,
                city,
                property_type,
                views,
                completed_bookings AS bookings,
                completion_rate::DOUBLE PRECISION AS conversion,
                payment_fail_rate::DOUBLE PRECISION AS fail_rate,
                total_revenue AS revenue,
                cancel_rate::DOUBLE PRECISION AS cancel_rate,
                performance_category
            FROM {schema}.property_performance
            WHERE (%s IS NULL OR city = %s)
            ORDER BY views DESC
            LIMIT %s
        """, (city, city, limit))
        return {"city": city or "All Cities", "properties": rows}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
```

---

### Phase 2: Frontend API Client

1. Generate TypeScript client from OpenAPI spec
2. Create React Query hooks for data fetching
3. Add loading states and error handling

**Files to modify:**
- `client/src/fastapi_client/` (auto-generated)
- Create `client/src/hooks/useAnalytics.ts`

### Phase 3: Dashboard Integration

1. Replace hardcoded data with API calls
2. Update types to match API responses
3. Handle loading and error states
4. Test all tab functionality

**Files to modify:**
- `client/src/pages/MarketplaceDashboard.tsx`

### Phase 4: Testing & Validation

1. Compare API results with expected data
2. Verify chart rendering with real data
3. Test edge cases (empty data, single city, etc.)
4. Performance testing with full dataset

---

## Lakebase Performance Considerations

### Why Lakebase Over SQL Warehouses?

| Aspect | Lakebase Provisioned | SQL Warehouse |
|--------|---------------------|---------------|
| Latency | ~10-50ms | ~500ms-2s (cold start) |
| Connection | Always-on PostgreSQL | Serverless compute |
| Protocol | PostgreSQL wire | Databricks SQL |
| Use Case | Real-time OLTP queries | Batch analytics |
| Cost Model | Per-hour instance | Per-query DBU |

**For dashboards:** Lakebase provides consistent sub-100ms response times ideal for interactive UIs.

### Caching Strategy

| Data | Cache Duration | Reason |
|------|---------------|--------|
| City list | 1 hour | Rarely changes |
| Investment matrix | 15 min | Aggregated, stable |
| Property data | 5 min | More dynamic |
| Device metrics | 5 min | Time-sensitive trends |

**Note:** With Lakebase's low latency, caching is optional but still recommended for high-traffic endpoints.

### Connection Pooling Best Practices

1. **Pool Size:** 2-10 connections per FastAPI worker
2. **Token Refresh:** Every 15 minutes (tokens expire at ~1 hour)
3. **Connection Reuse:** Keep connections open, return to pool after use
4. **SSL Required:** Always use `sslmode="require"`

### Synced Table Freshness

- **Sync Latency:** ~15 seconds (continuous mode)
- **Data Freshness:** Near real-time for dashboard use cases
- **Sync Status:** Check via `information_schema.sync_status` if needed

---

## Configuration Required

Before implementation, confirm these values:

| Configuration | Environment Variable | Description |
|--------------|---------------------|-------------|
| Instance Name | `LAKEBASE_INSTANCE_NAME` | Your Lakebase Provisioned instance name |
| Schema Name | `LAKEBASE_SCHEMA` | Schema where synced tables reside (e.g., `analytics`, `public`) |

### To Find Your Instance Details

```python
from databricks.sdk import WorkspaceClient

w = WorkspaceClient()

# List all Lakebase instances
for instance in w.database.list_database_instances():
    print(f"Instance: {instance.name}")
    print(f"  State: {instance.state}")
    print(f"  Endpoint: {instance.read_write_dns}")
    print()

# List catalogs registered for an instance
for catalog in w.database.list_database_catalogs(instance_name="<INSTANCE_NAME>"):
    print(f"Catalog: {catalog.name}, Database: {catalog.database_name}")
```

---

## Open Questions

1. **Instance Name:** What is the Lakebase Provisioned instance name for the synced tables?

2. **Schema Name:** What schema are the synced tables in (e.g., `analytics`, `public`)?

3. **Table Naming:** Are the synced tables named exactly as `city_investment`, `property_performance`, etc., or do they have prefixes/suffixes?

4. **Pagination:** For property data (18K records), should we paginate or limit by default?

5. **Property Type Filter:** Should Amenity tab filter by the 4 actual property types instead of house/apartment?

---

## Summary: API Endpoint → Dashboard Component Mapping

```
┌─────────────────────────────────────────────────────────────────┐
│                         OVERVIEW TAB                            │
├─────────────────────────────────────────────────────────────────┤
│  Investment Matrix  ←────── /api/city-investment                │
│  Quadrant Cards     ←────── /api/city-investment                │
│  Conversion Funnel  ←────── /api/city-funnel?city=X&range=Y     │
│  City Dropdown      ←────── /api/cities                         │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                      PROPERTY TAB                               │
├─────────────────────────────────────────────────────────────────┤
│  Scatter Chart      ←────── /api/properties?city=X              │
│  Property Cards     ←────── /api/properties?city=X              │
│  Properties Table   ←────── /api/properties?city=X              │
│  City Dropdown      ←────── /api/cities                         │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                       AMENITY TAB                               │
├─────────────────────────────────────────────────────────────────┤
│  Bar Chart          ←────── /api/amenities?city=X&type=Y        │
│  Insight Cards      ←────── /api/amenities?city=X&type=Y        │
│  Top by City Grid   ←────── /api/amenities/top-by-city          │
│  City Dropdown      ←────── /api/cities                         │
│  Type Dropdown      ←────── /api/property-types (or hardcode)   │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                       DEMAND TAB                                │
├─────────────────────────────────────────────────────────────────┤
│  Device Funnels     ←────── /api/device-metrics?city=X          │
│  Weekly Trend Chart ←────── /api/device-metrics?city=X          │
│  Diagnosis Banner   ←────── /api/device-metrics?city=X          │
│  City Dropdown      ←────── /api/cities                         │
└─────────────────────────────────────────────────────────────────┘
```

---

## Next Steps

1. **Provide Configuration** - Instance name and schema name for synced tables
2. **Test Connection** - Verify Lakebase connectivity with a test script
3. **Implement Phase 1** - Create `lakebase_service.py` and `analytics.py` router
4. **Test Endpoints** - Validate each endpoint returns expected data
5. **Implement Phase 2-4** - Frontend integration

### Quick Test Script

Once you provide the instance/schema names, we can run this to verify connectivity:

```python
# claude_scripts/test_lakebase.py

import os
import uuid
from databricks.sdk import WorkspaceClient
import psycopg2

# Set your configuration
INSTANCE_NAME = os.getenv("LAKEBASE_INSTANCE_NAME", "<YOUR_INSTANCE>")
SCHEMA_NAME = os.getenv("LAKEBASE_SCHEMA", "<YOUR_SCHEMA>")

w = WorkspaceClient()

# Get instance endpoint
print(f"Getting instance: {INSTANCE_NAME}")
instance = w.database.get_database_instance(name=INSTANCE_NAME)
print(f"  Endpoint: {instance.read_write_dns}")
print(f"  State: {instance.state}")

# Generate OAuth token
print("\nGenerating OAuth token...")
cred = w.database.generate_database_credential(
    request_id=str(uuid.uuid4()),
    instance_names=[INSTANCE_NAME]
)
print(f"  Token generated (expires: {cred.expiration_time})")

# Connect and test
print("\nConnecting to Lakebase...")
username = w.config.username or w.config.client_id
conn = psycopg2.connect(
    host=instance.read_write_dns,
    port=5432,
    dbname="databricks_postgres",
    user=username,
    password=cred.token,
    sslmode="require"
)

with conn.cursor() as cur:
    # Test 1: PostgreSQL version
    cur.execute("SELECT version()")
    print(f"\nPostgreSQL version: {cur.fetchone()[0][:50]}...")

    # Test 2: List schemas
    cur.execute("SELECT schema_name FROM information_schema.schemata")
    schemas = [row[0] for row in cur.fetchall()]
    print(f"\nAvailable schemas: {schemas}")

    # Test 3: List tables in target schema
    cur.execute(f"""
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = %s
        ORDER BY table_name
    """, (SCHEMA_NAME,))
    tables = [row[0] for row in cur.fetchall()]
    print(f"\nTables in '{SCHEMA_NAME}' schema: {tables}")

    # Test 4: Sample query
    if tables:
        cur.execute(f"SELECT COUNT(*) FROM {SCHEMA_NAME}.{tables[0]}")
        count = cur.fetchone()[0]
        print(f"\nRow count in {tables[0]}: {count}")

conn.close()
print("\n✓ Lakebase connection test successful!")
```

---

*Document created: 2026-02-11*
*Updated: 2026-02-12 — Migrated to Lakebase Provisioned*
*Status: Ready for Configuration*
