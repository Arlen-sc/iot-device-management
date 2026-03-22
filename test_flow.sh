#!/bin/bash
# ============================================================
# Test script for the Camera Data Collection & Device Flow
# ============================================================

BASE_URL="http://localhost:8080"
FLOW_ID="2035621991691743234"

echo "============================================"
echo "  IoT Flow Integration Test"
echo "============================================"
echo ""

# Clean up any previous test servers
curl -s -X POST "$BASE_URL/api/test/stop?port=9001" > /dev/null 2>&1
curl -s -X POST "$BASE_URL/api/test/stop?port=9002" > /dev/null 2>&1
curl -s -X POST "$BASE_URL/api/test/flow-server/stop?port=9100" > /dev/null 2>&1
curl -s -X DELETE "$BASE_URL/api/test/http-receiver/history" > /dev/null 2>&1
sleep 1

# Step 1: Start the camera simulator on port 9001
echo "[1] Starting camera test server on port 9001..."
echo "    (Returns hex: 1A,2B,3C,4D,5E,6F,7A,8B -> decimal: 26,43,60,77,94,111,122,139)"
curl -s -X POST "$BASE_URL/api/test/camera-server/start?port=9001&hexData=1A,2B,3C,4D,5E,6F,7A,8B" | python3 -c "import sys,json; d=json.load(sys.stdin); print('    OK:', d.get('data',{}).get('message',''))"
echo ""

# Step 2: Start the device simulator on port 9002
echo "[2] Starting device test server on port 9002..."
echo "    (Returns OK:0A,14,1E,28,32,3C -> decimal after parse: 10,20,30,40,50,60)"
curl -s -X POST "$BASE_URL/api/test/device-server/start?port=9002&responsePrefix=OK:&responseHexData=0A,14,1E,28,32,3C" | python3 -c "import sys,json; d=json.load(sys.stdin); print('    OK:', d.get('data',{}).get('message',''))"
echo ""

sleep 1

# Step 3: Execute the flow in background
echo "[3] Executing flow (background - will run through all 8 steps)..."
curl -s -X POST "$BASE_URL/api/task-flow-configs/$FLOW_ID/execute" > /tmp/flow_result.json 2>&1 &
CURL_PID=$!
echo "    Flow PID: $CURL_PID"
echo ""

# Step 4: Wait for TCP server to start (flow creates it at ~2s mark after delay)
echo "[4] Waiting 4s for flow to start TCP server and broadcast..."
sleep 4

# Step 5: Connect a test client to the flow's TCP server (port 9100)
echo "[5] Connecting test client to flow's TCP server (port 9100)..."
# First connect and read any available data
RECV=$(curl -s -X POST "$BASE_URL/api/test/tcp-client/connect?host=127.0.0.1&port=9100&sendData=&waitResponse=false" 2>/dev/null)
echo "    Client connected: $RECV"
echo ""

sleep 1

# Step 6: Send ACK_READY command
echo "[6] Sending ACK_READY command to flow's TCP server..."
SEND_RESULT=$(curl -s -X POST "$BASE_URL/api/test/send-command?host=127.0.0.1&port=9100&command=ACK_READY")
echo "    Result: $SEND_RESULT"
echo ""

# Step 7: Wait for flow to complete
echo "[7] Waiting for flow to complete (up to 30s)..."
WAIT_COUNT=0
while kill -0 $CURL_PID 2>/dev/null && [ $WAIT_COUNT -lt 30 ]; do
    sleep 1
    WAIT_COUNT=$((WAIT_COUNT + 1))
done
echo "    Flow completed after ~${WAIT_COUNT}s"
echo ""

# Step 8: Show results
echo "============================================"
echo "  FLOW EXECUTION RESULT"
echo "============================================"
python3 << 'PYEOF'
import json, sys
try:
    with open('/tmp/flow_result.json') as f:
        data = json.load(f)

    result = data.get('data', {})
    status = result.get('status', 'UNKNOWN')
    variables = result.get('variables', {})
    logs = result.get('logs', [])

    print(f"Status: {status}")
    print()
    print("=== Key Variables ===")
    for key in ['cameraRawData', 'hexArray', 'rs', 'rsLength', 'broadcastJson',
                'broadcastCount', 'receivedCommand', 'formattedValues',
                'deviceResponse', 'strippedData', 'responseDecArray',
                'parsedResult', 'httpResponse']:
        val = variables.get(key)
        if val is not None:
            val_str = str(val)
            if len(val_str) > 100:
                val_str = val_str[:100] + '...'
            print(f"  {key}: {val_str}")

    print()
    print("=== Execution Log ===")
    for log in logs:
        # Strip timestamp prefix
        msg = log.split('] ', 1)[-1] if '] ' in log else log
        print(f"  {msg}")

except Exception as e:
    print(f"Error parsing result: {e}")
    with open('/tmp/flow_result.json') as f:
        print(f.read())
PYEOF
echo ""

# Check HTTP receiver
echo "============================================"
echo "  HTTP RECEIVER (Step 8)"
echo "============================================"
curl -s "$BASE_URL/api/test/http-receiver/history" | python3 -m json.tool 2>/dev/null
echo ""

# Check database logs
echo "============================================"
echo "  DATABASE LOGS (Step 7)"
echo "============================================"
curl -s "$BASE_URL/api/flow-logs/$FLOW_ID?limit=10" | python3 -c "
import sys, json
data = json.load(sys.stdin).get('data',[])
if data:
    for d in data:
        ts = d.get('createdAt','')
        lvl = d.get('level','')
        msg = d.get('message','')
        node = d.get('nodeName','')
        print(f'  [{lvl}] {node}: {msg}')
        dj = d.get('dataJson')
        if dj:
            vs = str(dj)
            if len(vs) > 80: vs = vs[:80] + '...'
            print(f'         data: {vs}')
else:
    print('  (no logs)')
"
echo ""

# Cleanup
echo "[Cleanup] Stopping test servers..."
curl -s -X POST "$BASE_URL/api/test/stop?port=9001" > /dev/null 2>&1
curl -s -X POST "$BASE_URL/api/test/stop?port=9002" > /dev/null 2>&1
echo "Done."
