import json
import urllib.request
import urllib.parse
import time
import threading
import socket

def tcp_trigger():
    time.sleep(2) # wait for the flow to reach TCP_SERVER START and RECEIVE
    try:
        client = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        client.connect(('127.0.0.1', 9999))
        print("[Trigger] Connected to TCP_SERVER on 9999")
        # receive broadcast
        try:
            client.settimeout(2.0)
            data = client.recv(1024)
            print("[Trigger] Received broadcast:", data)
        except socket.timeout:
            print("[Trigger] No broadcast received")
            
        client.send(b"CMD_START\n")
        print("[Trigger] Sent CMD_START")
        client.close()
    except Exception as e:
        print("[Trigger] failed:", e)

def setup_and_run():
    # 1. Load flow json
    with open('scenario_flow.json', 'r', encoding='utf-8') as f:
        flow_json_str = f.read()

    # 2. Create task flow config
    create_payload = {
        "name": "Camera Device Scenario",
        "description": "Mock scenario for IT manager",
        "flowType": "DATA_PROCESS",
        "triggerType": "MANUAL",
        "executionMode": "SINGLE",
        "flowJson": flow_json_str,
        "status": 1
    }
    
    req = urllib.request.Request(
        'http://localhost:18080/api/task-flow-configs',
        data=json.dumps(create_payload).encode('utf-8'),
        headers={'Content-Type': 'application/json'}
    )
    
    with urllib.request.urlopen(req) as response:
        res = json.loads(response.read().decode())
        print("Create Flow Result:", res)

    req = urllib.request.Request('http://localhost:18080/api/task-flow-configs')
    with urllib.request.urlopen(req) as response:
        flows = json.loads(response.read().decode())['data']
        flow_id = flows[-1]['id']
        print("Flow ID to execute:", flow_id)
        
    # Start trigger thread
    threading.Thread(target=tcp_trigger, daemon=True).start()

    # 3. Execute the flow
    req = urllib.request.Request(
        f'http://localhost:18080/api/task-flow-configs/{flow_id}/execute',
        method='POST'
    )
    
    print("Executing flow...")
    with urllib.request.urlopen(req) as response:
        res = json.loads(response.read().decode())
        print("\n=== Execution Status ===")
        print(res.get('data', {}).get('status'))
        print("\n=== Variables ===")
        print(json.dumps(res.get('data', {}).get('variables'), indent=2))
        print("\n=== Logs ===")
        for log in res.get('data', {}).get('logs', []):
            print(log)

if __name__ == '__main__':
    setup_and_run()
