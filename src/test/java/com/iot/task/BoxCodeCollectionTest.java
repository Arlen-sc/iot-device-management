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
import java.io.InputStreamReader;
import java.io.OutputStreamWriter;
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
 * 端到端验证「箱码采集」流程。
 */
@SpringBootTest(classes = IotApplication.class, webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class BoxCodeCollectionTest {

    private static final int TCP_SERVER_PORT = 8888;

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
        tcpServerManager.stopServer(TCP_SERVER_PORT);
    }

    @Test
    void executeBoxCodeCollectionFlow() throws Exception {
        // 读取流程配置文件
        Path flowPath = Path.of("test/任务-箱码采集/箱码采集流程.json");
        Assertions.assertTrue(Files.exists(flowPath), "箱码采集流程.json 应存在");

        String json = Files.readString(flowPath);
        FlowDefinition flow = objectMapper.readValue(json, FlowDefinition.class);

        // 启动模拟TCP客户端，发送箱码数据
        ExecutorService pool = Executors.newFixedThreadPool(2);
        Future<?> boxCodeClient = pool.submit(this::runBoxCodeClient);

        Thread.sleep(1000);

        // 执行流程
        FlowExecutionContext ctx = new FlowExecutionContext();
        ctx.setFlowConfigId("box-code-test");
        ctx.setFlowName("BoxCodeCollectionTest");

        flowExecutor.execute(flow, ctx);

        // 等待测试完成
        boxCodeClient.get(60, TimeUnit.SECONDS);
        pool.shutdownNow();

        // 验证流程执行结果
        Assertions.assertTrue(ctx.isCompleted(), "流程应到达 END；日志: " + 
            String.join("\n", ctx.getExecutionLog().stream().map(e -> e.getMessage()).collect(java.util.stream.Collectors.toList())));

        // 验证PLC写入结果
        Object plcResult = ctx.getVariables().get("plcWriteResult");
        Assertions.assertNotNull(plcResult, "PLC写入结果应为非空");
    }

    private void runBoxCodeClient() {
        try {
            Thread.sleep(1500); // 等待TCP服务端启动
            try (Socket s = new Socket("127.0.0.1", TCP_SERVER_PORT)) {
                // 发送箱码数据
                String boxCode = "04001EM01008082406530276";
                PrintWriter out = new PrintWriter(
                        new OutputStreamWriter(s.getOutputStream(), StandardCharsets.UTF_8), true);
                out.println(boxCode);
                System.out.println("已发送箱码: " + boxCode);

                // 接收响应（如果有）
                BufferedReader in = new BufferedReader(new InputStreamReader(s.getInputStream(), StandardCharsets.UTF_8));
                String response = in.readLine();
                if (response != null) {
                    System.out.println("收到响应: " + response);
                }
            }
        } catch (Exception e) {
            System.err.println("箱码客户端模拟失败: " + e.getMessage());
            e.printStackTrace();
        }
    }
}
