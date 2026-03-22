import sqlite3

conn = sqlite3.connect('data/iot.db')
cursor = conn.cursor()

with open('init_aaa.sql', 'r') as f:
    sql_script = f.read()

cursor.executescript(sql_script)
conn.commit()
conn.close()
print("Table aaa created and populated successfully.")
