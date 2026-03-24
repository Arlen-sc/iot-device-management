package com.iot.task.node.impl;

import com.iot.task.engine.FlowExecutionContext;
import com.iot.task.model.FlowNode;
import com.iot.task.node.NodeHandler;
import com.iot.task.node.NodeResult;
import com.iot.util.VariablePathUtils;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.io.DataInputStream;
import java.io.DataOutputStream;
import java.net.Socket;
import java.nio.ByteBuffer;
import java.util.*;

/**
 * PLC_WRITE node - writes values to PLC registers via Modbus TCP.
 *
 * Config fields:
 *   host           - PLC IP address
 *   port           - Modbus TCP port (default 502)
 *   unitId         - Modbus slave unit ID (default 1)
 *   timeout        - connection timeout in ms (default 5000)
 *   registers      - list of register write operations:
 *     [{ "address": 0, "valueSource": "${httpResponse.data1}" },
 *      { "address": 1, "valueSource": "${httpResponse.data2}" }]
 *   writeAs        - AUTO | INT | STRING_ASCII（可选，默认 AUTO）
 *                    - AUTO: 数字按 INT 写入；非数字字符串按 ASCII 多寄存器写入
 *                    - INT: 强制按单寄存器整数写入
 *                    - STRING_ASCII: 按 ASCII 编码写入多个连续寄存器
 *
 * Uses raw Modbus TCP (Function Code 0x06 for single register,
 * 0x10 for multiple registers).
 */
@Slf4j
@Component
public class PlcWriteNodeHandler implements NodeHandler {

    @Override
    public String getType() {
        return "PLC_WRITE";
    }

    @Override
    @SuppressWarnings("unchecked")
    public NodeResult execute(FlowNode node, FlowExecutionContext context) {
        try {
            Map<String, Object> config = node.getConfig();
            if (config == null) {
                return NodeResult.error("PLC_WRITE node has no config");
            }

            // 中文注释：兼容设计器旧字段 ip，以及单地址+writeValue 的旧配置。
            String host = firstNonBlankString(config.get("host"), config.get("ip"));
            int port = toInt(config.get("port"), 502);
            int unitId = toInt(config.get("unitId"), 1);
            int timeout = toInt(config.get("timeout"), 5000);
            List<Map<String, Object>> registers = (List<Map<String, Object>>) config.get("registers");
            if (registers == null || registers.isEmpty()) {
                Object addr = config.get("address");
                Object wv = config.get("writeValue");
                if (addr != null || wv != null) {
                    Map<String, Object> one = new LinkedHashMap<>();
                    one.put("address", toInt(addr, 0));
                    one.put("valueSource", wv != null ? String.valueOf(wv) : "");
                    registers = new ArrayList<>();
                    registers.add(one);
                }
            }

            if (host == null || host.isBlank()) {
                return NodeResult.error("PLC_WRITE: host（或 ip）必填");
            }
            if (registers == null || registers.isEmpty()) {
                return NodeResult.error("PLC_WRITE: registers 至少配置一项，或使用 address+writeValue 单路写入");
            }

            log.info("PLC_WRITE node '{}': connecting to {}:{}", node.getName(), host, port);
            context.addLog("PLC connecting to " + host + ":" + port + " (unit " + unitId + ")");

            List<Map<String, Object>> results = new ArrayList<>();

            try (Socket socket = new Socket()) {
                socket.connect(new java.net.InetSocketAddress(host, port), timeout);
                socket.setSoTimeout(timeout);

                DataOutputStream out = new DataOutputStream(socket.getOutputStream());
                DataInputStream in = new DataInputStream(socket.getInputStream());

                int transactionId = 1;

                for (Map<String, Object> reg : registers) {
                    int address = toInt(reg.get("address"), 0);
                    String valueSource = (String) reg.get("valueSource");
                String writeAs = String.valueOf(reg.getOrDefault("writeAs", "AUTO")).toUpperCase(Locale.ROOT);

                // 中文注释：先取原始值，AUTO 模式下根据值类型决定 INT 还是字符串多寄存器写入。
                Object rawValue = resolveRawValue(valueSource, context);
                boolean useStringWrite = shouldWriteAsString(rawValue, writeAs);

                if (useStringWrite) {
                    String text = rawValue == null ? "" : String.valueOf(rawValue);
                    int writtenCount = writeAsciiToRegisters(out, in, transactionId, unitId, address, text);
                    transactionId += writtenCount;

                    Map<String, Object> regResult = new LinkedHashMap<>();
                    regResult.put("address", address);
                    regResult.put("value", text);
                    regResult.put("writeAs", "STRING_ASCII");
                    regResult.put("registerCount", writtenCount);
                    regResult.put("status", "OK");
                    results.add(regResult);
                    context.addLog("PLC string write @" + address + " (regs=" + writtenCount + "): " + abbreviate(text, 80));
                } else {
                    int value = resolveIntValue(rawValue);
                    log.info("PLC_WRITE: writing register {} = {}", address, value);

                    // Build Modbus TCP frame: Write Single Register (FC 0x06)
                    byte[] request = buildWriteSingleRegister(transactionId++, unitId, address, value);
                    out.write(request);
                    out.flush();

                    // Read response (12 bytes for FC 0x06 response)
                    byte[] response = new byte[12];
                    int read = 0;
                    while (read < 12) {
                        int n = in.read(response, read, 12 - read);
                        if (n == -1) break;
                        read += n;
                    }

                    // Check response - FC 0x06 echo back the same request
                    boolean success = read >= 12 && (response[7] & 0xFF) == 0x06;
                    String status = success ? "OK" : "ERROR (FC=0x" + Integer.toHexString(response[7] & 0xFF) + ")";

                    Map<String, Object> regResult = new LinkedHashMap<>();
                    regResult.put("address", address);
                    regResult.put("value", value);
                    regResult.put("writeAs", "INT");
                    regResult.put("status", status);
                    results.add(regResult);

                    context.addLog("PLC register " + address + " = " + value + " -> " + status);
                }
                }
            }

            context.setVariable("plcWriteResult", results);
            return NodeResult.ok(results);
        } catch (Exception e) {
            log.error("PLC_WRITE node '{}' failed: {}", node.getName(), e.getMessage(), e);
            context.addLog("PLC_WRITE error: " + e.getMessage());
            return NodeResult.error("PLC_WRITE failed: " + e.getMessage());
        }
    }

    /**
     * Build Modbus TCP frame for Write Single Register (Function Code 0x06).
     * Frame structure:
     *   [0-1] Transaction ID
     *   [2-3] Protocol ID (0x0000)
     *   [4-5] Length (6 bytes following)
     *   [6]   Unit ID
     *   [7]   Function Code (0x06)
     *   [8-9] Register Address
     *   [10-11] Register Value
     */
    private byte[] buildWriteSingleRegister(int transId, int unitId, int address, int value) {
        ByteBuffer buf = ByteBuffer.allocate(12);
        buf.putShort((short) transId);    // Transaction ID
        buf.putShort((short) 0);          // Protocol ID
        buf.putShort((short) 6);          // Length
        buf.put((byte) unitId);           // Unit ID
        buf.put((byte) 0x06);            // Function Code: Write Single Register
        buf.putShort((short) address);    // Register Address
        buf.putShort((short) value);      // Register Value
        return buf.array();
    }

    /**
     * Resolve an integer value from a variable reference (${path}) or literal string.
     */
    private Object resolveRawValue(String valueSource, FlowExecutionContext context) {
        if (valueSource == null) return null;
        valueSource = valueSource.trim();

        // Check for ${variable.path} syntax
        if (valueSource.startsWith("${") && valueSource.endsWith("}")) {
            String path = valueSource.substring(2, valueSource.length() - 1);
            return VariablePathUtils.getValue(context.getVariables(), path);
        }

        return valueSource;
    }

    private boolean shouldWriteAsString(Object rawValue, String writeAs) {
        if ("STRING_ASCII".equals(writeAs)) {
            return true;
        }
        if ("INT".equals(writeAs)) {
            return false;
        }
        // AUTO 模式：数字按 INT；其余字符串按 STRING_ASCII
        if (rawValue == null) {
            return false;
        }
        if (rawValue instanceof Number) {
            return false;
        }
        String s = String.valueOf(rawValue).trim();
        if (s.isEmpty()) {
            return false;
        }
        return !isNumericString(s);
    }

    private int resolveIntValue(Object rawValue) {
        if (rawValue == null) return 0;
        if (rawValue instanceof Number n) {
            return n.intValue();
        }
        return stringToInt(String.valueOf(rawValue));
    }

    /**
     * Convert string to integer, handling both numeric strings and alphanumeric codes.
     */
    private int stringToInt(String s) {
        if (s == null) return 0;
        s = s.trim();
        
        // Try direct numeric conversion first
        try { return Integer.parseInt(s); } catch (Exception ignored) {}
        try { return (int) Double.parseDouble(s); } catch (Exception ignored) {}
        
        // For alphanumeric codes like box codes, extract numeric part
        String numericPart = s.replaceAll("[^0-9]", "");
        if (!numericPart.isEmpty()) {
            try {
                // Take first 9 digits to fit in 32-bit integer
                if (numericPart.length() > 9) {
                    numericPart = numericPart.substring(0, 9);
                }
                return Integer.parseInt(numericPart);
            } catch (Exception ignored) {}
        }
        
        return 0;
    }

    private int writeAsciiToRegisters(DataOutputStream out,
                                      DataInputStream in,
                                      int transactionIdStart,
                                      int unitId,
                                      int startAddress,
                                      String text) throws Exception {
        byte[] bytes = text == null ? new byte[0] : text.getBytes(java.nio.charset.StandardCharsets.US_ASCII);
        if (bytes.length == 0) {
            // 空字符串写入 0 到首寄存器
            writeSingleRegister(out, in, transactionIdStart, unitId, startAddress, 0);
            return 1;
        }

        int regCount = (bytes.length + 1) / 2;
        for (int i = 0; i < regCount; i++) {
            int hi = bytes[i * 2] & 0xFF;
            int lo = (i * 2 + 1) < bytes.length ? (bytes[i * 2 + 1] & 0xFF) : 0;
            int value = (hi << 8) | lo;
            writeSingleRegister(out, in, transactionIdStart + i, unitId, startAddress + i, value);
        }
        return regCount;
    }

    private void writeSingleRegister(DataOutputStream out,
                                     DataInputStream in,
                                     int transactionId,
                                     int unitId,
                                     int address,
                                     int value) throws Exception {
        byte[] request = buildWriteSingleRegister(transactionId, unitId, address, value);
        out.write(request);
        out.flush();

        byte[] response = new byte[12];
        int read = 0;
        while (read < 12) {
            int n = in.read(response, read, 12 - read);
            if (n == -1) break;
            read += n;
        }
        boolean success = read >= 12 && (response[7] & 0xFF) == 0x06;
        if (!success) {
            throw new RuntimeException("PLC write failed at address " + address + ", FC=0x"
                    + Integer.toHexString(read >= 8 ? (response[7] & 0xFF) : -1));
        }
    }

    private boolean isNumericString(String s) {
        try {
            Double.parseDouble(s);
            return true;
        } catch (Exception ignored) {
            return false;
        }
    }

    private String abbreviate(String s, int max) {
        if (s == null) return "";
        return s.length() <= max ? s : s.substring(0, max) + "...";
    }

    private static int toInt(Object obj, int def) {
        if (obj instanceof Number n) return n.intValue();
        if (obj instanceof String s) {
            try { return Integer.parseInt(s); } catch (Exception ignored) {}
        }
        return def;
    }

    /** 中文注释：与 PLC_READ 一致，host / ip 二选一。 */
    private static String firstNonBlankString(Object a, Object b) {
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
}
