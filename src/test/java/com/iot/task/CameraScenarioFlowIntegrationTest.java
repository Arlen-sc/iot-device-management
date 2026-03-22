package com.iot.task;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.iot.IotApplication;
import com.iot.task.engine.FlowExecutionContext;
import com.iot.task.engine.FlowExecutor;
import com.iot.task.model.FlowDefinition;
import com.iot.task.tcp.TcpServerManager;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;

import java.io.BufferedReader;
import java.io.OutputStreamWriter;
import java.io.InputStreamReader;
import java.io.PrintWriter;
import java.net.ServerSocket;
import java.net.Socket;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

/**
 * 端到端验证「摄像头 TCP → 十六进制数组 → 条件 → TCP 广播/监听 → 第二设备 → 日志/HTTP」主流程。
 */
@SpringBootTest(classes = IotApplication.class, webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class CameraScenarioFlowIntegrationTest {

    private static final int CAMERA_PORT = 9001;
    private static final int RELAY_PORT = 9100;
    private static final int DEVICE_PORT = 9002;

    @LocalServerPort
    int serverPort;

    @Autowired
    FlowExecutor flowExecutor;

    @Autowired
    ObjectMapper objectMapper;

    @Autowired
    TcpServerManager tcpServerManager;

    @AfterEach
    void tearDown() {
        tcpServerManager.stopServer(RELAY_PORT);
    }

    @Test
    void executeCameraScenarioFromFlowDefinitionJson() throws Exception {
        Path flowPath = Path.of("flow_definition.json");
        Assertions.assertTrue(Files.exists(flowPath), "flow_definition.json 应在项目根目录");

        String json = Files.readString(flowPath);
        json = json.replace("127.0.0.1:18080", "127.0.0.1:" + serverPort);

        FlowDefinition flow = objectMapper.readValue(json, FlowDefinition.class);

        ExecutorService pool = Executors.newFixedThreadPool(4);
        Future<?> camera = pool.submit(this::runCameraMockOnce);
        Future<?> device = pool.submit(this::runDeviceMockOnce);
        Future<?> relayClient = pool.submit(this::runRelaySideClient);

        Thread.sleep(400);

        FlowExecutionContext ctx = new FlowExecutionContext();
        ctx.setFlowConfigId("integration-test");
        ctx.setFlowName("CameraScenarioFlowIntegrationTest");

        flowExecutor.execute(flow, ctx);

        camera.get(60, TimeUnit.SECONDS);
        device.get(60, TimeUnit.SECONDS);
        relayClient.get(60, TimeUnit.SECONDS);
        pool.shutdownNow();

        Assertions.assertTrue(ctx.isCompleted(), "流程应到达 END；日志: " + String.join("\n", ctx.getExecutionLog()));
        @SuppressWarnings("unchecked")
        var parsed = (java.util.Map<String, Object>) ctx.getVariables().get("parsedResult");
        Assertions.assertNotNull(parsed);
        Assertions.assertEquals("ok", String.valueOf(parsed.get("status")));
    }

    private void runCameraMockOnce() {
        try (ServerSocket ss = new ServerSocket(CAMERA_PORT)) {
            ss.setSoTimeout(120_000);
            try (Socket c = ss.accept()) {
                c.getOutputStream().write(new byte[]{1, 2, 3, 4, 5, 6, 7});
                c.getOutputStream().flush();
            }
        } catch (Exception e) {
            throw new RuntimeException("camera mock", e);
        }
    }

    private void runDeviceMockOnce() {
        try (ServerSocket ss = new ServerSocket(DEVICE_PORT)) {
            ss.setSoTimeout(120_000);
            try (Socket c = ss.accept()) {
                BufferedReader in = new BufferedReader(new InputStreamReader(c.getInputStream(), StandardCharsets.UTF_8));
                in.readLine();
                String payload = "{\"status\":\"ok\",\"n\":1}";
                String hex = toHexUtf8(payload);
                PrintWriter out = new PrintWriter(
                        new OutputStreamWriter(c.getOutputStream(), StandardCharsets.UTF_8), true);
                out.println("OK:" + hex);
            }
        } catch (Exception e) {
            throw new RuntimeException("device mock", e);
        }
    }

    private void runRelaySideClient() {
        try {
            Thread.sleep(800);
            try (Socket s = new Socket("127.0.0.1", RELAY_PORT)) {
                BufferedReader in = new BufferedReader(new InputStreamReader(s.getInputStream(), StandardCharsets.UTF_8));
                String broadcast = in.readLine();
                if (broadcast == null || broadcast.isEmpty()) {
                    throw new IllegalStateException("未收到广播");
                }
                PrintWriter out = new PrintWriter(
                        new OutputStreamWriter(s.getOutputStream(), StandardCharsets.UTF_8), true);
                out.println("ACK_READY");
            }
        } catch (Exception e) {
            throw new RuntimeException("relay client mock", e);
        }
    }

    private static String toHexUtf8(String s) {
        byte[] b = s.getBytes(StandardCharsets.UTF_8);
        StringBuilder sb = new StringBuilder(b.length * 2);
        for (byte x : b) {
            sb.append(String.format("%02X", x & 0xFF));
        }
        return sb.toString();
    }
}
