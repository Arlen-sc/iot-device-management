import sqlite3
import json

conn = sqlite3.connect('data/iot.db')
cursor = conn.cursor()

def build_edges(nodes):
    edges = []
    for node in nodes:
        if 'nextNodeId' in node:
            edges.append({"source": node['id'], "target": node['nextNodeId']})
        if node['type'] == 'CONDITION':
            if 'config' in node and 'branches' in node['config']:
                for branch in node['config']['branches']:
                    if 'nextNodeId' in branch:
                        edges.append({"source": node['id'], "target": branch['nextNodeId']})
            if 'config' in node and 'defaultNextNodeId' in node['config']:
                edges.append({"source": node['id'], "target": node['config']['defaultNextNodeId']})
    return edges

# Task 1: TCP Server (Mock Modbus)
nodes1 = [
    {"id": "start", "type": "START", "nextNodeId": "start_server"},
    {"id": "start_server", "type": "TCP_SERVER", "config": {"port": 5020, "operation": "START"}, "nextNodeId": "receive"},
    {"id": "receive", "type": "TCP_SERVER", "config": {"port": 5020, "operation": "RECEIVE", "timeout": 30000, "outputVariable": "plcData"}, "nextNodeId": "log"},
    {"id": "log", "type": "LOG", "config": {"message": "PLC Server got: ${plcData}"}, "nextNodeId": "stop"},
    {"id": "stop", "type": "TCP_SERVER", "config": {"port": 5020, "operation": "STOP"}, "nextNodeId": "end"},
    {"id": "end", "type": "END"}
]
flow1 = {"nodes": nodes1, "edges": build_edges(nodes1)}

# Task 2: TCP Client Test
nodes2 = [
    {"id": "start", "type": "START", "nextNodeId": "client"},
    {"id": "client", "type": "TCP_CLIENT", "config": {"host": "127.0.0.1", "port": 8000, "sendData": "xx12345678yy", "waitResponse": True, "timeout": 5000}, "nextNodeId": "log"},
    {"id": "log", "type": "LOG", "config": {"message": "Client got: ${tcpClientData}"}, "nextNodeId": "end"},
    {"id": "end", "type": "END"}
]
flow2 = {"nodes": nodes2, "edges": build_edges(nodes2)}

# Task 3: Complex Logic
nodes3 = [
    {"id": "start", "type": "START", "nextNodeId": "start_server"},
    {"id": "start_server", "type": "TCP_SERVER", "config": {"port": 8000, "operation": "START"}, "nextNodeId": "receive"},
    {"id": "receive", "type": "TCP_SERVER", "config": {"port": 8000, "operation": "RECEIVE", "timeout": 60000, "outputVariable": "clientData"}, "nextNodeId": "extract"},
    {"id": "extract", "type": "SCRIPT", "config": {
        "operations": [
            {"op": "SUBSTRING", "source": "clientData", "target": "barcode", "params": {"start": 2, "end": 10}}
        ]
    }, "nextNodeId": "query_db"},
    {"id": "query_db", "type": "DATA_LOAD", "config": {
        "dbMode": "LOCAL",
        "sql": "SELECT * FROM aaa WHERE barcode = '${barcode}'",
        "outputVariable": "dbResult"
    }, "nextNodeId": "check_db"},
    {"id": "check_db", "type": "CONDITION", "config": {
        "branches": [
            {"name": "Found", "condition": {"left": "dbResult", "operator": "array_length_gt", "right": 0}, "nextNodeId": "format_resp"}
        ],
        "defaultNextNodeId": "stop_server"
    }},
    {"id": "format_resp", "type": "SCRIPT", "config": {
        "operations": [
            {"op": "JSON_BUILD", "target": "respData", "params": {
                "fields": {
                    "barcode": "${dbResult[0].barcode}",
                    "box_code": "${dbResult[0].box_code}",
                    "seq_num": "${dbResult[0].seq_num}"
                }
            }}
        ]
    }, "nextNodeId": "send_resp"},
    {"id": "send_resp", "type": "TCP_SERVER", "config": {"port": 8000, "operation": "BROADCAST", "sendData": "${respData}"}, "nextNodeId": "plc_write"},
    {"id": "plc_write", "type": "TCP_CLIENT", "config": {
        "host": "127.0.0.1",
        "port": 5020,
        "sendData": "Write Box: ${dbResult[0].box_code}, Seq: ${dbResult[0].seq_num}, Barcode: ${dbResult[0].barcode}",
        "waitResponse": False
    }, "nextNodeId": "stop_server"},
    {"id": "stop_server", "type": "TCP_SERVER", "config": {"port": 8000, "operation": "STOP"}, "nextNodeId": "end"},
    {"id": "end", "type": "END"}
]
flow3 = {"nodes": nodes3, "edges": build_edges(nodes3)}

cursor.execute("DELETE FROM task_flow_config WHERE name IN ('TCP Server Service', 'TCP Client Service', 'Complex Logic')")

cursor.execute("INSERT INTO task_flow_config (name, description, flow_json) VALUES (?, ?, ?)", 
               ("TCP Server Service", "Provides TCP Server", json.dumps(flow1)))
cursor.execute("INSERT INTO task_flow_config (name, description, flow_json) VALUES (?, ?, ?)", 
               ("TCP Client Service", "Provides TCP Client", json.dumps(flow2)))
cursor.execute("INSERT INTO task_flow_config (name, description, flow_json) VALUES (?, ?, ?)", 
               ("Complex Logic", "Listen, query DB, return data, write to PLC", json.dumps(flow3)))

conn.commit()
conn.close()
print("Tasks created.")
