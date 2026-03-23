#!/bin/bash
# ============================================================
# 8步全链路集成测试脚本
# 场景：摄像头采集 → 数据转换 → 广播 → 等待ACK → 发送设备 → 解析 → 日志 → HTTP推送
#
# 前置条件：Spring Boot 应用已启动在 18082 端口
# ============================================================
set -e

BASE_URL="http://localhost:18082"
PASS=0
FAIL=0

check() {
    local desc="$1" expected="$2" actual="$3"
    if echo "$actual" | grep -q "$expected"; then
        echo "  ✓ $desc"
        PASS=$((PASS+1))
    else
        echo "  ✗ $desc (expected: $expected, got: $actual)"
        FAIL=$((FAIL+1))
    fi
}

echo "========================================"
echo "  IoT 8步全链路集成测试"
echo "========================================"

# ---- 0. 清理历史 ----
echo ""
echo "[0] 清理历史数据..."
curl -s -X DELETE "$BASE_URL/api/flow-logs" > /dev/null 2>&1
curl -s -X DELETE "$BASE_URL/api/test/http-receiver/history" > /dev/null 2>&1

# ---- 1. 启动模拟服务器 ----
echo ""
echo "[1] 启动模拟服务器..."
R1=$(curl -s -X POST "$BASE_URL/api/test/camera-server/start?port=9001&hexData=1A,2B,3C,4D,5E,6F,7A,8B")
check "摄像头模拟器(9001)" "Camera test server started" "$R1"

R2=$(curl -s -X POST "$BASE_URL/api/test/device-server/start?port=9002&responsePrefix=OK:&responseHexData=0A,14,1E,28,32,3C")
check "设备模拟器(9002)" "Device test server started" "$R2"

R3=$(curl -s -X POST "$BASE_URL/api/test/flow-server/start?port=9100")
check "流程TCP服务器(9100)" "Flow TCP server started" "$R3"

# ---- 2. 创建流程配置 ----
echo ""
echo "[2] 创建8步流程配置..."
CREATE_RESP=$(curl -s -X POST "$BASE_URL/api/task-flow-configs" \
    -H 'Content-Type: application/json' \
    -d @flow_definition_8step.json)
check "创建流程" "200" "$CREATE_RESP"

FLOW_ID=$(curl -s "$BASE_URL/api/task-flow-configs" | python3 -c "
import sys,json
flows=json.load(sys.stdin)['data']
for f in flows:
    if '8步' in f.get('name',''):
        print(f['id']); break
" 2>/dev/null)
echo "  流程ID: $FLOW_ID"

if [ -z "$FLOW_ID" ]; then
    echo "  ✗ 无法获取流程ID，中止测试"
    exit 1
fi

# ---- 3. 异步执行流程 ----
echo ""
echo "[3] 执行流程(异步)..."
curl -s -X POST "$BASE_URL/api/task-flow-configs/$FLOW_ID/execute" > /tmp/test_flow_result.json &
EXEC_PID=$!

# ---- 4. 等待流程执行到等待ACK阶段，然后发送ACK ----
echo "[4] 等待流程到达TCP等待阶段..."
sleep 5

echo "[5] 发送 ACK_READY 指令..."
ACK_RESP=$(curl -s -X POST "$BASE_URL/api/test/send-command?host=localhost&port=9100&command=ACK_READY")
check "发送ACK_READY" "ACK_READY" "$ACK_RESP"

# ---- 5. 等待流程完成 ----
echo ""
echo "[6] 等待流程完成..."
wait $EXEC_PID 2>/dev/null

# ---- 6. 验证结果 ----
echo ""
echo "[7] 验证执行结果..."
RESULT=$(cat /tmp/test_flow_result.json)

STATUS=$(echo "$RESULT" | python3 -c "import sys,json;print(json.load(sys.stdin)['data']['status'])" 2>/dev/null)
check "流程状态=SUCCESS" "SUCCESS" "$STATUS"

# 验证关键变量
VARS=$(echo "$RESULT" | python3 -c "
import sys,json
v=json.load(sys.stdin)['data']['variables']
print('cameraRawData=' + str(v.get('cameraRawData','')))
print('rsLength=' + str(v.get('rsLength','')))
print('clientCommand=' + str(v.get('clientCommand','')))
print('deviceResponse=' + str(v.get('deviceResponse','')))
print('parsedResult=' + str(v.get('parsedResult','')))
print('saveAffected=' + str(v.get('saveResult',{}).get('affectedRows','')))
print('httpStatus=' + str(v.get('httpResult',{}).get('statusCode','')))
" 2>/dev/null)

check "Step1:摄像头数据" "1A,2B,3C" "$VARS"
check "Step2:数组长度>=6" "rsLength=8" "$VARS"
check "Step4:收到ACK" "clientCommand=ACK_READY" "$VARS"
check "Step6:设备响应" "deviceResponse=OK:0A,14" "$VARS"
check "Step6:解析结果" '"r1":"10"' "$VARS"
check "Step7:DB保存" "saveAffected=1" "$VARS"
check "Step8:HTTP推送" "httpStatus=200" "$VARS"

# ---- 7. 验证数据库日志 ----
echo ""
echo "[8] 验证数据库日志..."
LOGS=$(curl -s "$BASE_URL/api/flow-logs?limit=10")
LOG_COUNT=$(echo "$LOGS" | python3 -c "import sys,json;print(len(json.load(sys.stdin).get('data',[])))" 2>/dev/null)
check "日志记录数>0" "true" "$([ "$LOG_COUNT" -gt 0 ] 2>/dev/null && echo true || echo false)"

# ---- 8. 验证HTTP接收 ----
echo ""
echo "[9] 验证HTTP接收历史..."
HTTP_HIST=$(curl -s "$BASE_URL/api/test/http-receiver/history")
HTTP_COUNT=$(echo "$HTTP_HIST" | python3 -c "import sys,json;print(len(json.load(sys.stdin).get('data',[])))" 2>/dev/null)
check "HTTP接收记录>0" "true" "$([ "$HTTP_COUNT" -gt 0 ] 2>/dev/null && echo true || echo false)"

# ---- 9. 清理模拟服务器 ----
echo ""
echo "[10] 清理..."
curl -s -X POST "$BASE_URL/api/test/stop?port=9001" > /dev/null 2>&1
curl -s -X POST "$BASE_URL/api/test/stop?port=9002" > /dev/null 2>&1
curl -s -X POST "$BASE_URL/api/test/flow-server/stop?port=9100" > /dev/null 2>&1

# ---- 结果 ----
echo ""
echo "========================================"
echo "  测试结果: $PASS 通过, $FAIL 失败"
echo "========================================"

[ $FAIL -eq 0 ] && exit 0 || exit 1
