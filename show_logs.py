import sqlite3

conn = sqlite3.connect('data/iot.db')
cursor = conn.cursor()

# Get the latest flow execution logs
cursor.execute("""
    SELECT flow_name, message, created_at
    FROM flow_execution_log
    ORDER BY id DESC
    LIMIT 50
""")

for row in reversed(cursor.fetchall()):
    print(f"[{row[2]}] {row[0]}: {row[1]}")

conn.close()
