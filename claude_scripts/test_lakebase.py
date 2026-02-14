"""Test Lakebase Provisioned connectivity."""

import os
import uuid

os.environ["DATABRICKS_CONFIG_PROFILE"] = "one-env-temp"

from databricks.sdk import WorkspaceClient
import psycopg2

# Configuration
INSTANCE_NAME = "marketplace-intel-db"
CATALOG = "lakebase_marketplace"
SCHEMA = "gold"

print("=" * 60)
print("LAKEBASE CONNECTION TEST")
print("=" * 60)

# Initialize workspace client
w = WorkspaceClient()
print(f"\nWorkspace: {w.config.host}")

# Get current user's email (required for Lakebase auth)
current_user = w.current_user.me()
username = current_user.user_name  # This is the email
print(f"User: {username}")

# Get instance details
print(f"\n1. Getting instance: {INSTANCE_NAME}")
instance = w.database.get_database_instance(name=INSTANCE_NAME)
print(f"   Endpoint: {instance.read_write_dns}")
print(f"   State: {instance.state}")

# Generate OAuth token
print("\n2. Generating OAuth token...")
cred = w.database.generate_database_credential(
    request_id=str(uuid.uuid4()),
    instance_names=[INSTANCE_NAME]
)
print(f"   Token generated (length: {len(cred.token)})")
print(f"   Expires: {cred.expiration_time}")

# Connect to Lakebase
print("\n3. Connecting to Lakebase...")
conn = psycopg2.connect(
    host=instance.read_write_dns,
    port=5432,
    dbname="databricks_postgres",
    user=username,
    password=cred.token,
    sslmode="require"
)
print("   Connected!")

with conn.cursor() as cur:
    # Test: PostgreSQL version
    cur.execute("SELECT version()")
    version = cur.fetchone()[0]
    print(f"\n4. PostgreSQL: {version[:60]}...")

    # Test: List tables in gold schema
    print(f"\n5. Tables in '{SCHEMA}' schema:")
    cur.execute("""
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = %s
        ORDER BY table_name
    """, (SCHEMA,))
    tables = [row[0] for row in cur.fetchall()]
    for t in tables:
        print(f"   - {t}")

    # Test: Sample query from city_investment
    print(f"\n6. Sample data from {SCHEMA}.city_investment:")
    cur.execute(f"""
        SELECT city, total_viewers, conversion_rate, quadrant
        FROM {SCHEMA}.city_investment
        ORDER BY estimated_revenue DESC
        LIMIT 5
    """)
    rows = cur.fetchall()
    for row in rows:
        print(f"   {row[0]}: {row[1]:,} viewers, {row[2]:.1f}% conv, {row[3]}")

    # Test: Count rows in each table
    print(f"\n7. Row counts:")
    for table in tables:
        cur.execute(f"SELECT COUNT(*) FROM {SCHEMA}.{table}")
        count = cur.fetchone()[0]
        print(f"   {table}: {count:,} rows")

conn.close()
print("\n" + "=" * 60)
print("LAKEBASE CONNECTION TEST SUCCESSFUL!")
print("=" * 60)
