import sqlite3

conn = sqlite3.connect('data/iot.db')
cursor = conn.cursor()
cursor.execute("SELECT name, last_execution_status FROM task_flow_config WHERE name IN ('TCP Server Service', 'TCP Client Service', 'Complex Logic')")
for row in cursor.fetchall():
    print(row)
conn.close()
