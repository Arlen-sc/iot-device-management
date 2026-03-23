package com.iot.task.node.impl;

import com.iot.task.engine.FlowExecutionContext;
import com.iot.task.model.FlowNode;
import com.iot.task.node.NodeHandler;
import com.iot.task.node.NodeResult;
import com.iot.util.VariablePathUtils;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.io.*;
import java.net.InetSocketAddress;
import java.net.Socket;
import java.nio.charset.Charset;
import java.nio.charset.StandardCharsets;
import java.util.Map;

/**
 * TCP_CLIENT node - connects to a TCP server, sends data, and optionally receives a response.
 *
 * Config fields:
 *   host             - target IP/hostname (required)
 *   port             - target port (required)
 *   sendData         - data to send (supports ${variable} placeholders)
 *   sendHex          - if true, sendData is treated as hex string and converted to bytes
 *   waitResponse     - whether to wait for a response (default false，与设计器一致)
 *   charset          - character encoding (default UTF-8)
 *   readMode         - LINE | LENGTH | DELIMITER (default LINE)
 *   readLength       - bytes to read when readMode=LENGTH
 *   delimiter        - stop character when readMode=DELIMITER
 *   outputVariable   - variable name to store received data (default "tcpClientData")
 */
@Slf4j
@Component
public class TcpClientNodeHandler implements NodeHandler {
    private static final int CONNECT_TIMEOUT_MS = 5000;

    @Override
    public String getType() {
        return "TCP_CLIENT";
    }

    @Override
    public NodeResult execute(FlowNode node, FlowExecutionContext context) {
        try {
            Map<String, Object> config = node.getConfig();
            if (config == null) {
                return NodeResult.error("TCP_CLIENT node has no config");
            }

            String host = (String) config.get("host");
            int port = toInt(config.get("port"), 0);
            String charsetName = (String) config.getOrDefault("charset", "UTF-8");
            String readMode = (String) config.getOrDefault("readMode", "LINE");
            boolean waitResponse = toBool(config.get("waitResponse"), false);
            boolean sendHex = toBool(config.get("sendHex"), false);
            String outputVar = (String) config.getOrDefault("outputVariable", "tcpClientData");

            // Resolve sendData with variable placeholders
            String sendDataRaw = (String) config.get("sendData");
            String sendData = sendDataRaw != null ? resolveVariables(sendDataRaw, context) : null;

            if (host == null || host.isBlank() || port <= 0) {
                return NodeResult.error("TCP_CLIENT: host and port are required");
            }

            Charset charset = StandardCharsets.UTF_8;
            try { charset = Charset.forName(charsetName); } catch (Exception ignored) {}

            log.info("TCP_CLIENT node '{}': connecting to {}:{}", node.getName(), host, port);
            context.addLog("TCP_CLIENT connecting to " + host + ":" + port);

            String receivedData = null;
            try (Socket socket = new Socket()) {
                socket.connect(new InetSocketAddress(host, port), CONNECT_TIMEOUT_MS);
                // 场景要求：连接成功后收发阶段采用阻塞等待，不使用读取超时。
                socket.setSoTimeout(0);

                // Send data if provided
                if (sendData != null && !sendData.isEmpty()) {
                    byte[] dataToSend;
                    String sentPreview;
                    if (sendHex) {
                        dataToSend = hexStringToBytes(sendData);
                        sentPreview = abbreviate(sendData.replaceAll("\\s+", ""), 120);
                    } else {
                        dataToSend = (sendData + "\n").getBytes(charset);
                        sentPreview = abbreviate(sendData, 120);
                    }
                    socket.getOutputStream().write(dataToSend);
                    socket.getOutputStream().flush();
                    context.addLog("INFO", "TCP_CLIENT sent " + dataToSend.length + " bytes",
                            "TCP_CLIENT", node.getName(), sentPreview, null);
                    log.info("TCP_CLIENT sent {} bytes to {}:{}", dataToSend.length, host, port);
                }

                // Wait for response
                if (waitResponse) {
                    context.addLog("INFO", "TCP_CLIENT waiting response (blocking)",
                            "TCP_CLIENT", node.getName(), null, null);
                    receivedData = readResponse(socket, readMode, config, charset);
                    context.addLog("INFO", "TCP_CLIENT received: " + abbreviate(receivedData, 120),
                            "TCP_CLIENT", node.getName(), abbreviate(receivedData, 120), null);
                    log.info("TCP_CLIENT received {} chars from {}:{}",
                            receivedData != null ? receivedData.length() : 0, host, port);
                }
            }

            if (receivedData != null) {
                context.setVariable(outputVar, receivedData);
            }
            return NodeResult.ok(receivedData);

        } catch (Exception e) {
            log.error("TCP_CLIENT node '{}' failed: {}", node.getName(), e.getMessage(), e);
            context.addLog("TCP_CLIENT error: " + e.getMessage());
            return NodeResult.error("TCP_CLIENT failed: " + e.getMessage());
        }
    }

    private String readResponse(Socket socket, String readMode, Map<String, Object> config, Charset charset) throws IOException {
        switch (readMode.toUpperCase()) {
            case "LENGTH" -> {
                int readLen = toInt(config.get("readLength"), 1024);
                byte[] buf = new byte[readLen];
                int totalRead = 0;
                var is = socket.getInputStream();
                while (totalRead < readLen) {
                    int n = is.read(buf, totalRead, readLen - totalRead);
                    if (n == -1) break;
                    totalRead += n;
                }
                return new String(buf, 0, totalRead, charset);
            }
            case "DELIMITER" -> {
                String delimiter = (String) config.getOrDefault("delimiter", "\n");
                char delChar = delimiter.isEmpty() ? '\n' : delimiter.charAt(0);
                var reader = new BufferedReader(new InputStreamReader(socket.getInputStream(), charset));
                StringBuilder sb = new StringBuilder();
                int ch;
                while ((ch = reader.read()) != -1) {
                    if ((char) ch == delChar) break;
                    sb.append((char) ch);
                }
                return sb.toString();
            }
            case "RAW" -> {
                // Read all available bytes
                int readLen = toInt(config.get("readLength"), 4096);
                byte[] buf = new byte[readLen];
                int n = socket.getInputStream().read(buf);
                if (n == -1) return "";
                // Return as hex string for binary data
                return bytesToHexString(buf, n);
            }
            default -> { // LINE
                var reader = new BufferedReader(new InputStreamReader(socket.getInputStream(), charset));
                String line = reader.readLine();
                return line != null ? line : "";
            }
        }
    }

    private String resolveVariables(String template, FlowExecutionContext context) {
        if (template == null) return null;
        StringBuilder sb = new StringBuilder();
        int i = 0;
        while (i < template.length()) {
            if (i + 1 < template.length() && template.charAt(i) == '$' && template.charAt(i + 1) == '{') {
                int end = template.indexOf('}', i + 2);
                if (end > 0) {
                    String varPath = template.substring(i + 2, end);
                    Object val = VariablePathUtils.getValue(context.getVariables(), varPath);
                    sb.append(val != null ? val.toString() : "");
                    i = end + 1;
                    continue;
                }
            }
            sb.append(template.charAt(i));
            i++;
        }
        return sb.toString();
    }

    static byte[] hexStringToBytes(String hex) {
        hex = hex.replaceAll("\\s+", "").replaceAll("0x", "").replaceAll("0X", "");
        int len = hex.length();
        byte[] data = new byte[len / 2];
        for (int i = 0; i < len; i += 2) {
            data[i / 2] = (byte) ((Character.digit(hex.charAt(i), 16) << 4)
                    + Character.digit(hex.charAt(i + 1), 16));
        }
        return data;
    }

    static String bytesToHexString(byte[] bytes, int length) {
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < length; i++) {
            sb.append(String.format("%02X", bytes[i] & 0xFF));
        }
        return sb.toString();
    }

    private static boolean toBool(Object obj, boolean def) {
        if (obj instanceof Boolean b) return b;
        if (obj instanceof String s) return "true".equalsIgnoreCase(s);
        return def;
    }

    private static int toInt(Object obj, int def) {
        if (obj instanceof Number n) return n.intValue();
        if (obj instanceof String s) {
            try { return Integer.parseInt(s); } catch (Exception ignored) {}
        }
        return def;
    }

    private static String abbreviate(String s, int max) {
        if (s == null) return "";
        return s.length() <= max ? s : s.substring(0, max) + "...";
    }
}
