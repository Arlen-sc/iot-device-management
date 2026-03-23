import requests
import json
import time

BASE_URL = 'http://localhost:18082/api/task-flow-configs'
LOGIN_URL = 'http://localhost:18082/login'

def run():
    print("Logging in...")
    session = requests.Session()
    # Perform form login
    login_data = {'username': 'admin', 'password': 'admin123'}
    res = session.post(LOGIN_URL, data=login_data)
    
    print("Loading flow definition...")
    with open('camera_scenario_flow.json', 'r', encoding='utf-8') as f:
        flow_json = f.read()
    
    # 1. Create task
    payload = {
        "name": "Camera Data Process Scenario",
        "description": "IT Manager Scenario: Camera -> Transform -> Broadcast -> Wait CMD -> Device -> HTTP Push",
        "flowType": "DATA_PROCESS",
        "triggerType": "ONCE",
        "flowJson": flow_json,
        "status": 2
    }
    
    print("Creating task...")
    r = session.post(BASE_URL, json=payload)
    if r.status_code != 200:
        print("Failed to create task:", r.text)
        return
        
    try:
        print("Task created:", r.json())
    except Exception as e:
        print("Failed to parse JSON response:", r.text)
        return
    
    # 2. Get the latest task to find ID
    r = session.get(BASE_URL)
    tasks = r.json().get('data', [])
    if not tasks:
        print("No tasks found")
        return
        
    task_id = tasks[-1]['id']
    print(f"Executing task ID: {task_id}")
    
    # 3. Execute
    r = session.post(f"{BASE_URL}/{task_id}/execute")
    try:
        result = r.json()
    except Exception as e:
        print("Failed to parse execution result:")
        print(r.text[:500])
        return

    
    if result.get('code') == 200:
        data = result['data']
        print(f"\n=== Execution Status: {data['status']} ===")
        print("\n=== Variables ===")
        for k, v in data.get('variables', {}).items():
            print(f"  {k}: {v}")
            
        print("\n=== Execution Logs ===")
        for log in data.get('logs', []):
            if isinstance(log, dict):
                print(f"[{log.get('timestamp')}] [{log.get('level')}] [{log.get('nodeName')}] {log.get('message')}")
            else:
                print(log)
    else:
        print("Execution failed:", result)

if __name__ == '__main__':
    run()
