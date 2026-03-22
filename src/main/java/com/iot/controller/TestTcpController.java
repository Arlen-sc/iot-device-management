package com.iot.controller;

import com.iot.task.tcp.TcpServerManager;
import com.iot.util.R;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;

import java.io.*;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.concurrent.*;

/**
 * Controller providing test TCP endpoints for flow testing.
 * Creates mock TCP servers/clients that simulate real devices.
 */
@Slf4j
@RestController
@RequestMapping("/api/test")
public class TestTcpController {

    private final TcpServerManager tcpServerManager;
    private final ConcurrentHashMap<Integer, TestServer> testServers = new ConcurrentHashMap<>();

    public TestTcpController(TcpServerManager tcpServerManager) {
        this.tcpServerManager = tcpServerManager;
    }

    /**
     * Start a mock "camera" TCP server that returns hex data when connected.
     * Simulates a camera returning parameter data as hex array.
     */
    @PostMapping("/camera-server/start")
    public R<?> startCameraServer(@RequestParam(defaultValue = "9001") int port,
                                   @RequestParam(defaultValue = "1A,2B,3C,4D,5E,6F,7A,8B") String hexData) {
        try {
            ServerSocket ss = new ServerSocket(port);
            TestServer server = new TestServer(port, ss, "camera");
            testServers.put(port, server);

            Thread t = new Thread(() -> {
                while (server.running) {
                    try {
                        ss.setSoTimeout(1000);
                        Socket client = ss.accept();
                        log.info("[Test Camera] Client connected on port {}", port);
                        // Send hex data immediately
                        String response = hexData + "\n";
                        client.getOutputStream().write(response.getBytes(StandardCharsets.UTF_8));
                        client.getOutputStream().flush();
                        log.info("[Test Camera] Sent: {}", hexData);
                        // Keep connection open briefly
                        Thread.sleep(500);
                        client.close();
                    } catch (SocketTimeoutException ignored) {
                    } catch (Exception e) {
                        if (server.running) log.error("[Test Camera] Error: {}", e.getMessage());
                    }
                }
                try { ss.close(); } catch (IOException ignored) {}
            }, "test-camera-" + port);
            t.setDaemon(true);
            t.start();

            return R.ok(Map.of("port", port, "type", "camera", "data", hexData,
                    "message", "Camera test server started on port " + port));
        } catch (Exception e) {
            return R.error("Failed to start camera server: " + e.getMessage());
        }
    }

    /**
     * Start a mock "device" TCP server that:
     * 1. Receives commands
     * 2. Returns data with a fixed prefix
     * Simulates a PLC/industrial device.
     */
    @PostMapping("/device-server/start")
    public R<?> startDeviceServer(@RequestParam(defaultValue = "9002") int port,
                                   @RequestParam(defaultValue = "OK:") String responsePrefix,
                                   @RequestParam(defaultValue = "0A,14,1E,28,32,3C") String responseHexData) {
        try {
            ServerSocket ss = new ServerSocket(port);
            TestServer server = new TestServer(port, ss, "device");
            testServers.put(port, server);

            Thread t = new Thread(() -> {
                while (server.running) {
                    try {
                        ss.setSoTimeout(1000);
                        Socket client = ss.accept();
                        log.info("[Test Device] Client connected on port {}", port);

                        BufferedReader reader = new BufferedReader(
                                new InputStreamReader(client.getInputStream(), StandardCharsets.UTF_8));
                        String command = reader.readLine();
                        log.info("[Test Device] Received command: {}", command);
                        server.receivedCommands.add(command);

                        // Respond with prefix + hex data
                        String response = responsePrefix + responseHexData + "\n";
                        client.getOutputStream().write(response.getBytes(StandardCharsets.UTF_8));
                        client.getOutputStream().flush();
                        log.info("[Test Device] Sent response: {}", response.trim());

                        Thread.sleep(500);
                        client.close();
                    } catch (SocketTimeoutException ignored) {
                    } catch (Exception e) {
                        if (server.running) log.error("[Test Device] Error: {}", e.getMessage());
                    }
                }
                try { ss.close(); } catch (IOException ignored) {}
            }, "test-device-" + port);
            t.setDaemon(true);
            t.start();

            return R.ok(Map.of("port", port, "type", "device", "prefix", responsePrefix,
                    "data", responseHexData,
                    "message", "Device test server started on port " + port));
        } catch (Exception e) {
            return R.error("Failed to start device server: " + e.getMessage());
        }
    }

    /**
     * Start a test TCP client that connects to a TCP server port
     * and can send commands, simulating a downstream consumer.
     */
    @PostMapping("/tcp-client/connect")
    public R<?> testTcpClientConnect(@RequestParam String host,
                                      @RequestParam int port,
                                      @RequestParam(defaultValue = "") String sendData,
                                      @RequestParam(defaultValue = "true") boolean waitResponse) {
        try {
            Socket socket = new Socket();
            socket.connect(new InetSocketAddress(host, port), 5000);
            socket.setSoTimeout(5000);

            Map<String, Object> result = new LinkedHashMap<>();
            result.put("connected", true);
            result.put("remoteAddress", host + ":" + port);

            if (!sendData.isEmpty()) {
                socket.getOutputStream().write((sendData + "\n").getBytes(StandardCharsets.UTF_8));
                socket.getOutputStream().flush();
                result.put("sent", sendData);
            }

            if (waitResponse) {
                BufferedReader reader = new BufferedReader(
                        new InputStreamReader(socket.getInputStream(), StandardCharsets.UTF_8));
                String response = reader.readLine();
                result.put("received", response);
            }

            socket.close();
            return R.ok(result);
        } catch (Exception e) {
            return R.error("TCP client error: " + e.getMessage());
        }
    }

    /**
     * Send a command to a TCP server port (e.g., to simulate a downstream
     * client sending an acknowledgment command to the flow's TCP server).
     */
    @PostMapping("/send-command")
    public R<?> sendCommand(@RequestParam String host,
                             @RequestParam int port,
                             @RequestParam String command) {
        try {
            Socket socket = new Socket();
            socket.connect(new InetSocketAddress(host, port), 5000);
            socket.getOutputStream().write((command + "\n").getBytes(StandardCharsets.UTF_8));
            socket.getOutputStream().flush();
            socket.close();
            return R.ok(Map.of("sent", command, "to", host + ":" + port));
        } catch (Exception e) {
            return R.error("Send command error: " + e.getMessage());
        }
    }

    /**
     * Stop a test server.
     */
    @PostMapping("/stop")
    public R<?> stopTestServer(@RequestParam int port) {
        TestServer server = testServers.remove(port);
        if (server == null) {
            return R.error("No test server running on port " + port);
        }
        server.running = false;
        try { server.serverSocket.close(); } catch (IOException ignored) {}
        return R.ok(Map.of("port", port, "stopped", true));
    }

    /**
     * List all running test servers.
     */
    @GetMapping("/list")
    public R<?> listTestServers() {
        List<Map<String, Object>> list = new ArrayList<>();
        testServers.forEach((port, server) -> {
            Map<String, Object> info = new LinkedHashMap<>();
            info.put("port", port);
            info.put("type", server.type);
            info.put("running", server.running);
            info.put("receivedCommands", server.receivedCommands);
            list.add(info);
        });
        return R.ok(list);
    }

    /**
     * Start the flow's TCP server (used by the flow for broadcasting).
     */
    @PostMapping("/flow-server/start")
    public R<?> startFlowServer(@RequestParam(defaultValue = "9100") int port) {
        try {
            tcpServerManager.startServer(port);
            return R.ok(Map.of("port", port, "message", "Flow TCP server started"));
        } catch (Exception e) {
            return R.error("Failed to start flow server: " + e.getMessage());
        }
    }

    @PostMapping("/flow-server/stop")
    public R<?> stopFlowServer(@RequestParam(defaultValue = "9100") int port) {
        tcpServerManager.stopServer(port);
        return R.ok(Map.of("port", port, "message", "Flow TCP server stopped"));
    }

    // ---- Internal ----

    private static class TestServer {
        final int port;
        final ServerSocket serverSocket;
        final String type;
        final List<String> receivedCommands = new CopyOnWriteArrayList<>();
        volatile boolean running = true;

        TestServer(int port, ServerSocket serverSocket, String type) {
            this.port = port;
            this.serverSocket = serverSocket;
            this.type = type;
        }
    }
}
