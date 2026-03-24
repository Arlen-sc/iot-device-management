package com.iot.task.node.impl;

import com.iot.task.engine.FlowExecutionContext;
import com.iot.task.model.FlowNode;
import com.iot.task.node.NodeHandler;
import com.iot.task.node.NodeResult;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.io.DataInputStream;
import java.io.DataOutputStream;
import java.net.Socket;
import java.nio.ByteBuffer;
import java.util.*;

/**
 * PLC_READ 节点：通过 Modbus TCP 读取保持寄存器（Function Code 0x03）。
 * <p>
 * 配置字段：
 * <ul>
 *   <li>{@code host} — PLC IP（兼容旧字段 {@code ip}）</li>
 *   <li>{@code port} — 端口，默认 502</li>
 *   <li>{@code unitId} — 从站号，默认 1</li>
 *   <li>{@code timeout} — 超时毫秒，默认 5000</li>
 *   <li>{@code reads} — 读取任务列表，每项：{@code address} 起始地址，{@code quantity} 寄存器个数（可选，默认 1）</li>
 *   <li>{@code outputVariable} — 结果写入上下文变量名，默认 {@code plcReadResult}</li>
 * </ul>
 * 结果：{@code List<Map>}，每项含 {@code startAddress}、{@code quantity}、{@code values}（16 位无符号整数列表）。
 */
@Slf4j
@Component
public class PlcReadNodeHandler implements NodeHandler {

    private static final int FC_READ_HOLDING_REGISTERS = 0x03;

    @Override
    public String getType() {
        return "PLC_READ";
    }

    @Override
    @SuppressWarnings("unchecked")
    public NodeResult execute(FlowNode node, FlowExecutionContext context) {
        try {
            Map<String, Object> config = node.getConfig();
            if (config == null) {
                return NodeResult.error("PLC_READ node has no config");
            }

            String host = firstNonBlank(config.get("host"), config.get("ip"));
            int port = toInt(config.get("port"), 502);
            int unitId = toInt(config.get("unitId"), 1);
            int timeout = toInt(config.get("timeout"), 5000);
            List<Map<String, Object>> reads = (List<Map<String, Object>>) config.get("reads");
            String outputVar = Objects.toString(config.getOrDefault("outputVariable", "plcReadResult"), "plcReadResult");

            if (host == null || host.isBlank()) {
                return NodeResult.error("PLC_READ: host (或 ip) 必填");
            }
            if (reads == null || reads.isEmpty()) {
                return NodeResult.error("PLC_READ: reads 至少配置一条读取项");
            }

            log.info("PLC_READ node '{}': {}:{}", node.getName(), host, port);
            context.addLog("PLC read connecting to " + host + ":" + port + " (unit " + unitId + ")");

            List<Map<String, Object>> results = new ArrayList<>();

            try (Socket socket = new Socket()) {
                socket.connect(new java.net.InetSocketAddress(host, port), timeout);
                socket.setSoTimeout(timeout);

                DataOutputStream out = new DataOutputStream(socket.getOutputStream());
                DataInputStream in = new DataInputStream(socket.getInputStream());

                int transactionId = 1;

                for (Map<String, Object> item : reads) {
                    int startAddress = toInt(item.get("address"), 0);
                    int quantity = toInt(item.get("quantity"), 1);
                    if (quantity < 1 || quantity > 125) {
                        return NodeResult.error("PLC_READ: quantity 必须在 1~125 之间, got " + quantity);
                    }

                    byte[] request = buildReadHoldingRegistersRequest(transactionId++, unitId, startAddress, quantity);
                    out.write(request);
                    out.flush();

                    byte[] response = readFullResponse(in);
                    List<Integer> values = parseReadHoldingRegistersResponse(response, unitId, quantity);

                    Map<String, Object> one = new LinkedHashMap<>();
                    one.put("startAddress", startAddress);
                    one.put("quantity", quantity);
                    one.put("values", values);
                    results.add(one);

                    context.addLog("PLC read @" + startAddress + " x" + quantity + " -> " + abbreviate(values.toString(), 120));
                }
            }

            context.setVariable(outputVar, results);
            context.setVariable("plcReadResult", results);
            return NodeResult.ok(results);
        } catch (Exception e) {
            log.error("PLC_READ node '{}' failed: {}", node.getName(), e.getMessage(), e);
            context.addLog("PLC_READ error: " + e.getMessage());
            return NodeResult.error("PLC_READ failed: " + e.getMessage());
        }
    }

    /**
     * 中文注释：构造 Modbus TCP 读保持寄存器请求（FC 0x03）。
     */
    private byte[] buildReadHoldingRegistersRequest(int transId, int unitId, int startAddress, int quantity) {
        // 中文注释：PDU 长度 = Unit(1) + FC(1) + 起始地址(2) + 数量(2) = 6
        ByteBuffer buf = ByteBuffer.allocate(12);
        buf.putShort((short) transId);
        buf.putShort((short) 0);
        buf.putShort((short) 6);
        buf.put((byte) unitId);
        buf.put((byte) FC_READ_HOLDING_REGISTERS);
        buf.putShort((short) startAddress);
        buf.putShort((short) quantity);
        return buf.array();
    }

    /**
     * 中文注释：读取一帧 Modbus TCP 响应（先读 MBAP 头再读剩余长度）。
     */
    private byte[] readFullResponse(DataInputStream in) throws Exception {
        byte[] header = new byte[6];
        readFully(in, header);
        int len = ((header[4] & 0xFF) << 8) | (header[5] & 0xFF);
        byte[] rest = new byte[len];
        readFully(in, rest);
        byte[] full = new byte[6 + len];
        System.arraycopy(header, 0, full, 0, 6);
        System.arraycopy(rest, 0, full, 6, len);
        return full;
    }

    private void readFully(DataInputStream in, byte[] buf) throws Exception {
        int off = 0;
        while (off < buf.length) {
            int n = in.read(buf, off, buf.length - off);
            if (n == -1) {
                throw new RuntimeException("PLC read: connection closed");
            }
            off += n;
        }
    }

    /**
     * 中文注释：解析 0x03 响应，返回每个寄存器的 16 位无符号值。
     */
    private List<Integer> parseReadHoldingRegistersResponse(byte[] response, int unitId, int expectedQuantity) {
        if (response.length < 9) {
            throw new RuntimeException("PLC read: response too short");
        }
        int pduUnit = response[6] & 0xFF;
        if (pduUnit != (unitId & 0xFF)) {
            log.warn("PLC read: unit id mismatch response={} expected={}", pduUnit, unitId);
        }
        int fc = response[7] & 0xFF;
        if ((fc & 0x80) != 0) {
            int ex = response.length > 8 ? (response[8] & 0xFF) : -1;
            throw new RuntimeException("PLC read Modbus exception, FC=0x" + Integer.toHexString(fc) + ", code=" + ex);
        }
        if (fc != FC_READ_HOLDING_REGISTERS) {
            throw new RuntimeException("PLC read: unexpected FC=0x" + Integer.toHexString(fc));
        }
        int byteCount = response[8] & 0xFF;
        if (byteCount != expectedQuantity * 2) {
            throw new RuntimeException("PLC read: byte count mismatch, got " + byteCount + " expect " + (expectedQuantity * 2));
        }
        List<Integer> values = new ArrayList<>(expectedQuantity);
        for (int i = 0; i < expectedQuantity; i++) {
            int hi = response[9 + i * 2] & 0xFF;
            int lo = response[10 + i * 2] & 0xFF;
            values.add((hi << 8) | lo);
        }
        return values;
    }

    private String firstNonBlank(Object a, Object b) {
        if (a != null) {
            String s = String.valueOf(a).trim();
            if (!s.isEmpty()) {
                return s;
            }
        }
        if (b != null) {
            String s = String.valueOf(b).trim();
            if (!s.isEmpty()) {
                return s;
            }
        }
        return null;
    }

    private String abbreviate(String s, int max) {
        if (s == null) {
            return "";
        }
        return s.length() <= max ? s : s.substring(0, max) + "...";
    }

    private static int toInt(Object obj, int def) {
        if (obj instanceof Number n) {
            return n.intValue();
        }
        if (obj instanceof String s) {
            try {
                return Integer.parseInt(s.trim());
            } catch (Exception ignored) {
            }
        }
        return def;
    }
}
