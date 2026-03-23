package com.iot.task.tcp;

import com.iot.task.model.FlowDefinition;
import com.iot.task.model.FlowNode;

import java.util.*;

/**
 * 从任务配置与流程图解析 TCP 角色及端口、对端地址，用于启动前检查与引擎行为。
 */
public final class TcpFlowAnalysis {

    public enum TcpFlowRole {
        /** 无 TCP 节点 */
        NONE,
        /** 主要为连接远端（TCP_CLIENT / TCP_SEND / TCP_LISTEN） */
        TCP_CLIENT,
        /** 主要为本机监听（TCP_SERVER） */
        TCP_SERVER,
        /** 同时包含服务端与客户端类节点 */
        MIXED
    }

    public record HostPort(String host, int port) {}

    private TcpFlowAnalysis() {}

    public static TcpFlowRole resolveRole(String flowTypeConfig, FlowDefinition flow) {
        if (flowTypeConfig != null) {
            switch (flowTypeConfig) {
                case "TCP_CLIENT" -> {
                    return TcpFlowRole.TCP_CLIENT;
                }
                case "TCP_SERVER" -> {
                    return TcpFlowRole.TCP_SERVER;
                }
                default -> {
                }
            }
        }
        if (flow == null || flow.getNodes() == null) {
            return TcpFlowRole.NONE;
        }
        boolean hasServerNode = false;
        boolean hasClientNode = false;
        for (FlowNode n : flow.getNodes()) {
            if (n == null || n.getType() == null) {
                continue;
            }
            String t = n.getType();
            if ("TCP_SERVER".equals(t)) {
                hasServerNode = true;
            } else if ("TCP_CLIENT".equals(t) || "TCP_SEND".equals(t) || "TCP_LISTEN".equals(t)) {
                hasClientNode = true;
            }
        }
        if (hasServerNode && hasClientNode) {
            return TcpFlowRole.MIXED;
        }
        if (hasServerNode) {
            return TcpFlowRole.TCP_SERVER;
        }
        if (hasClientNode) {
            return TcpFlowRole.TCP_CLIENT;
        }
        return TcpFlowRole.NONE;
    }

    /** 流程中 TCP_SERVER 节点使用的监听端口（去重、合法端口） */
    public static List<Integer> collectListenerPorts(FlowDefinition flow) {
        if (flow == null || flow.getNodes() == null) {
            return List.of();
        }
        Set<Integer> ports = new LinkedHashSet<>();
        for (FlowNode n : flow.getNodes()) {
            if (n == null || !"TCP_SERVER".equals(n.getType())) {
                continue;
            }
            Map<String, Object> c = n.getConfig();
            int port = toInt(c != null ? c.get("port") : null, 0);
            if (port > 0 && port <= 65535) {
                ports.add(port);
            }
        }
        return new ArrayList<>(ports);
    }

    /** 客户端类节点连接的对端 host:port（去重） */
    public static List<HostPort> collectClientEndpoints(FlowDefinition flow) {
        if (flow == null || flow.getNodes() == null) {
            return List.of();
        }
        Set<String> seen = new LinkedHashSet<>();
        List<HostPort> out = new ArrayList<>();
        for (FlowNode n : flow.getNodes()) {
            if (n == null || n.getType() == null) {
                continue;
            }
            String t = n.getType();
            if (!"TCP_CLIENT".equals(t) && !"TCP_SEND".equals(t) && !"TCP_LISTEN".equals(t)) {
                continue;
            }
            Map<String, Object> c = n.getConfig();
            if (c == null) {
                continue;
            }
            String host = str(c.get("host"));
            int port = toInt(c.get("port"), 0);
            if (host == null || host.isBlank() || port <= 0 || port > 65535) {
                continue;
            }
            String key = host.trim() + ":" + port;
            if (seen.add(key)) {
                out.add(new HostPort(host.trim(), port));
            }
        }
        return out;
    }

    private static String str(Object o) {
        return o == null ? null : String.valueOf(o);
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
