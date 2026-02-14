"""Script to get summary statistics from the data."""
import os
from databricks.sdk import WorkspaceClient

os.environ["DATABRICKS_CONFIG_PROFILE"] = "one-env-temp"
w = WorkspaceClient()

CATALOG = "serverless_dbdkzc_catalog"
SCHEMA = "default"

def get_warehouse_id() -> str:
    warehouses = list(w.warehouses.list())
    for wh in warehouses:
        if wh.state and wh.state.value == "RUNNING":
            return wh.id
    return warehouses[0].id

def run_query(sql: str):
    result = w.statement_execution.execute_statement(
        warehouse_id=get_warehouse_id(),
        statement=sql,
        wait_timeout="50s"
    )
    if result.result and result.result.data_array:
        return result.result.data_array
    return []

queries = {
    "Total Cities": f"SELECT COUNT(DISTINCT city) FROM {CATALOG}.{SCHEMA}.gold_city_investment",
    "Total Properties": f"SELECT COUNT(*) FROM {CATALOG}.{SCHEMA}.gold_property_performance",
    "Total Bookings": f"SELECT COUNT(*) FROM {CATALOG}.{SCHEMA}.silver_bookings_enriched",
    "Total Clickstream Events": f"SELECT COUNT(*) FROM {CATALOG}.{SCHEMA}.silver_clickstream",
    "Date Range (Clickstream)": f"SELECT MIN(event_date), MAX(event_date) FROM {CATALOG}.{SCHEMA}.silver_clickstream",
    "Cities List": f"SELECT DISTINCT city FROM {CATALOG}.{SCHEMA}.gold_city_investment ORDER BY city",
    "Property Types": f"SELECT DISTINCT property_type, COUNT(*) as cnt FROM {CATALOG}.{SCHEMA}.gold_property_performance GROUP BY property_type ORDER BY cnt DESC",
    "Quadrant Distribution": f"SELECT quadrant, COUNT(*) as cnt FROM {CATALOG}.{SCHEMA}.gold_city_investment GROUP BY quadrant ORDER BY cnt DESC",
    "Performance Categories": f"SELECT performance_category, COUNT(*) as cnt FROM {CATALOG}.{SCHEMA}.gold_property_performance GROUP BY performance_category ORDER BY cnt DESC",
    "Device Distribution": f"SELECT device, COUNT(*) as events FROM {CATALOG}.{SCHEMA}.silver_clickstream GROUP BY device ORDER BY events DESC",
    "Amenity Categories": f"SELECT DISTINCT amenity_category FROM {CATALOG}.{SCHEMA}.gold_amenity_lift",
    "Top 10 Cities by Revenue": f"SELECT city, estimated_revenue FROM {CATALOG}.{SCHEMA}.gold_city_investment ORDER BY estimated_revenue DESC LIMIT 10",
}

print("=" * 70)
print("DATA SUMMARY - serverless_dbdkzc_catalog.default")
print("=" * 70)

for name, sql in queries.items():
    print(f"\n{name}:")
    print("-" * 40)
    rows = run_query(sql)
    for row in rows:
        print("  ", row)
