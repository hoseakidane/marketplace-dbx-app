"""Script to explore data in serverless_dbdkzc_catalog.default schema."""
import os
from databricks.sdk import WorkspaceClient

# Initialize client using the profile
os.environ["DATABRICKS_CONFIG_PROFILE"] = "one-env-temp"
w = WorkspaceClient()

CATALOG = "serverless_dbdkzc_catalog"
SCHEMA = "default"

def query_table(table_name: str, limit: int = 10) -> None:
    """Query a table and print results."""
    print(f"\n{'='*60}")
    print(f"TABLE: {table_name}")
    print('='*60)

    sql = f"SELECT * FROM {CATALOG}.{SCHEMA}.{table_name} LIMIT {limit}"

    try:
        result = w.statement_execution.execute_statement(
            warehouse_id=get_warehouse_id(),
            statement=sql,
            wait_timeout="30s"
        )

        if result.manifest and result.manifest.schema:
            columns = [col.name for col in result.manifest.schema.columns]
            print(f"Columns: {columns}")
            print("-" * 60)

        if result.result and result.result.data_array:
            for row in result.result.data_array:
                print(row)
        else:
            print("No data returned")

    except Exception as e:
        print(f"Error querying {table_name}: {e}")

def get_warehouse_id() -> str:
    """Get the first available SQL warehouse ID."""
    warehouses = list(w.warehouses.list())
    if not warehouses:
        raise ValueError("No SQL warehouses available")

    # Prefer running warehouses
    for wh in warehouses:
        if wh.state and wh.state.value == "RUNNING":
            print(f"Using warehouse: {wh.name} ({wh.id})")
            return wh.id

    # Otherwise use the first one
    print(f"Using warehouse: {warehouses[0].name} ({warehouses[0].id})")
    return warehouses[0].id

def main():
    tables = [
        "gold_city_investment",
        "gold_city_funnel",
        "gold_property_performance",
        "gold_amenity_lift",
        "gold_amenity_city_top",
        "gold_device_funnel",
        "gold_device_diagnosis",
        "silver_bookings_enriched",
        "silver_clickstream",
    ]

    print("Exploring serverless_dbdkzc_catalog.default schema")
    print("=" * 60)

    for table in tables:
        query_table(table)

if __name__ == "__main__":
    main()
