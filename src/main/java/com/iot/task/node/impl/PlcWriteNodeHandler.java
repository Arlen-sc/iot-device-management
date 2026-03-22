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

            String host = (String) config.get("host");
            int port = toInt(config.get("port"), 502);
            int unitId = toInt(config.get("unitId"), 1);
            int timeout = toInt(config.get("timeout"), 5000);
            List<Map<String, Object>> registers = (List<Map<String, Object>>) config.get("registers");

            if (host == null || host.isBlank()) {
                return NodeResult.error("PLC_WRITE: host is required");
            }
            if (registers == null || registers.isEmpty()) {
                return NodeResult.error("PLC_WRITE: at least one register write is required");
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

                    // Resolve value from variable path or literal
                    int value = resolveIntValue(valueSource, context);

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
                    regResult.put("status", status);
                    results.add(regResult);

                    context.addLog("PLC register " + address + " = " + value + " -> " + status);
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
    private int resolveIntValue(String valueSource, FlowExecutionContext context) {
        if (valueSource == null) return 0;
        valueSource = valueSource.trim();

        // Check for ${variable.path} syntax
        if (valueSource.startsWith("${") && valueSource.endsWith("}")) {
            String path = valueSource.substring(2, valueSource.length() - 1);
            Object val = VariablePathUtils.getValue(context.getVariables(), path);
            if (val instanceof Number n) return n.intValue();
            if (val instanceof String s) {
                try { return Integer.parseInt(s.trim()); } catch (Exception ignored) {}
                try { return (int) Double.parseDouble(s.trim()); } catch (Exception ignored) {}
            }
            return 0;
        }

        // Literal numeric value
        try { return Integer.parseInt(valueSource); } catch (Exception ignored) {}
        try { return (int) Double.parseDouble(valueSource); } catch (Exception ignored) {}
        return 0;
    }

    private static int toInt(Object obj, int def) {
        if (obj instanceof Number n) return n.intValue();
        if (obj instanceof String s) {
            try { return Integer.parseInt(s); } catch (Exception ignored) {}
        }
        return def;
    }
}
