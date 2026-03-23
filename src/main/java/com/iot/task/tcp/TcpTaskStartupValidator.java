package com.iot.task.tcp;

import com.iot.entity.TaskFlowConfig;
import com.iot.task.model.FlowDefinition;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.net.BindException;
import java.net.InetSocketAddress;
import java.net.ServerSocket;
import java.net.Socket;
import java.util.ArrayList;
import java.util.List;

/**
 * 任务启动前检查 TCP 资源是否可用：服务端端口可绑定（或已由本进程托管）、客户端对端可连通。
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class TcpTaskStartupValidator {

    private static final int CLIENT_PROBE_TIMEOUT_MS = 2500;

    private final TcpServerManager tcpServerManager;

    /**
     * 按流程图中实际出现的 TCP 节点检查：监听端口可绑定（或已由本进程托管）、客户端对端可连通。
     * 不依赖任务 flowType 字段，避免配置与画布不一致时漏检。
     */
    public void validateBeforeRun(TaskFlowConfig config, FlowDefinition flow) {
        List<Integer> ports = TcpFlowAnalysis.collectListenerPorts(flow);
        List<TcpFlowAnalysis.HostPort> clients = TcpFlowAnalysis.collectClientEndpoints(flow);
        if (ports.isEmpty() && clients.isEmpty()) {
            return;
        }
        if (config != null) {
            log.info("TCP 资源检查: task id={}, name={}, listenerPorts={}, clientEndpoints={}",
                    config.getId(), config.getName(), ports.size(), clients.size());
        }

        List<String> errors = new ArrayList<>();

        for (int port : ports) {
            try {
                validateListenerPort(port);
            } catch (Exception e) {
                errors.add(e.getMessage());
            }
        }
        for (TcpFlowAnalysis.HostPort hp : clients) {
            try {
                probeClientEndpoint(hp.host(), hp.port());
            } catch (Exception e) {
                errors.add(e.getMessage());
            }
        }

        if (!errors.isEmpty()) {
            throw new IllegalStateException(String.join("；", errors));
        }
    }

    /**
     * 本任务将绑定的端口：若已由 {@link TcpServerManager} 托管则视为可用；否则尝试临时绑定检测是否被占用。
     */
    public void validateListenerPort(int port) throws IOException {
        if (port <= 0 || port > 65535) {
            throw new IllegalStateException("无效的 TCP 监听端口: " + port);
        }
        if (tcpServerManager.isRunning(port)) {
            log.debug("Port {} already managed by TcpServerManager, OK", port);
            return;
        }
        try (ServerSocket ss = new ServerSocket(port)) {
            ss.setReuseAddress(true);
        } catch (BindException e) {
            throw new IllegalStateException(
                    "TCP 监听端口 " + port + " 已被占用，无法启动本任务的 TCP 服务（请更换端口或释放占用）", e);
        }
    }

    private void probeClientEndpoint(String host, int port) throws IOException {
        try (Socket s = new Socket()) {
            s.connect(new InetSocketAddress(host, port), CLIENT_PROBE_TIMEOUT_MS);
        } catch (IOException e) {
            throw new IllegalStateException(
                    "无法连接 TCP 对端 " + host + ":" + port + "（请确认对端服务已启动且网络可达）: " + e.getMessage(), e);
        }
    }
}
