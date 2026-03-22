import requests
import threading
import time
import sqlite3

# Get task IDs
conn = sqlite3.connect('data/iot.db')
cursor = conn.cursor()
cursor.execute("SELECT id, name FROM task_flow_config WHERE name IN ('TCP Server Service', 'TCP Client Service', 'Complex Logic')")
tasks = cursor.fetchall()
conn.close()

task_map = {name: tid for tid, name in tasks}

def run_task(name):
    tid = task_map.get(name)
    if tid:
        print(f"Starting {name} (ID: {tid})...")
        try:
            resp = requests.post(f"http://localhost:18082/api/task-flow-configs/{tid}/execute", timeout=65)
            print(f"Result for {name}: {resp.json()}")
        except Exception as e:
            print(f"Error running {name}: {e}")

if __name__ == "__main__":
    t1 = threading.Thread(target=run_task, args=("TCP Server Service",))
    t1.start()
    
    time.sleep(2) # wait for server to start
    
    t3 = threading.Thread(target=run_task, args=("Complex Logic",))
    t3.start()
    
    time.sleep(2) # wait for logic server to start
    
    t2 = threading.Thread(target=run_task, args=("TCP Client Service",))
    t2.start()
    
    t1.join()
    t3.join()
    t2.join()
    print("All done!")
