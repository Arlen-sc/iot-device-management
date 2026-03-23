package com.iot.task.tcp;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import jakarta.annotation.PreDestroy;
import java.io.*;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.concurrent.*;

/**
 * 管理流程执行的 TCP 服务器实例。
 * 每个服务器由端口号标识。
 * 重要：数据按流程/任务 ID (eventId) 严格隔离，防止串台。
 * 支持：启动、广播给指定任务的客户端、从指定任务接收数据、停止。
 */
@Slf4j
@Service
public class TcpServerManager {

    private final ConcurrentHashMap<Integer, ManagedServer> servers = new ConcurrentHashMap<>();

    /**
     * 在给定端口启动 TCP 服务器（如果尚未运行）。
     */
    public synchronized void startServer(int port) throws IOException {
        if (servers.containsKey(port)) {
            log.info("TCP server already running on port {}", port);
            return;
        }

        ServerSocket serverSocket = new ServerSocket(port);
        serverSocket.setSoTimeout(500);
        ManagedServer server = new ManagedServer(port, serverSocket);
        servers.put(port, server);

        Thread acceptThread = new Thread(() -> acceptLoop(server), "tcp-server-accept-" + port);
        acceptThread.setDaemon(true);
        acceptThread.start();
        server.acceptThread = acceptThread;

        log.info("TCP server started on port {}", port);
    }

    /**
     * 向所有连接的客户端广播数据（不区分任务，用于广播场景）。
     * 注意：此方法会发送给所有客户端，请谨慎使用。
     */
    public int broadcast(int port, String data) throws IOException {
        return broadcast(port, null, data);
    }

    /**
     * 向指定任务的客户端广播数据。
     * 如果 eventId 为 null，则发送给所有客户端。
     * 重要：广播时需要客户端和任务关联，当前版本暂不支持客户端-task关联，
     * 因此 eventId 为 null 时发送给所有客户端。
     */
    public int broadcast(int port, String eventId, String data) throws IOException {
        ManagedServer server = servers.get(port);
        if (server == null) {
            throw new IOException("No TCP server running on port " + port);
        }

        byte[] bytes = (data + "\n").getBytes(StandardCharsets.UTF_8);
        int sent = 0;
        List<ClientConnection> deadClients = new ArrayList<>();

        for (ClientConnection client : server.clients) {
            try {
                if (client.socket.isClosed() || !client.socket.isConnected()) {
                    deadClients.add(client);
                    continue;
                }
                client.socket.getOutputStream().write(bytes);
                client.socket.getOutputStream().flush();
                sent++;
            } catch (IOException e) {
                log.warn("Failed to send to client {}: {}", client.address, e.getMessage());
                deadClients.add(client);
            }
        }

        for (ClientConnection dead : deadClients) {
            server.clients.remove(dead);
            closeQuietly(dead.socket);
        }

        log.info("Broadcast to {} clients on port {} (eventId: {}, {} bytes)", 
                sent, port, eventId, bytes.length);
        return sent;
    }

    /**
     * 等待来自任何客户端的数据（不区分任务）。
     * 返回超时时间内收到的第一条消息。
     * 注意：此方法可能会收到其他任务的数据，不推荐使用。
     */
    @Deprecated
    public String waitForData(int port, int timeoutMs) throws IOException {
        return waitForData(port, null, timeoutMs);
    }

    /**
     * 等待指定任务的数据。
     * 重要：严格按 eventId 隔离，确保不会串台。
     * 
     * @param port 服务器端口
     * @param eventId 流程/任务 ID，必须与数据生产者一致
     * @param timeoutMs 超时时间（毫秒）
     * @return 接收到的数据，超时返回 null
     */
    public String waitForData(int port, String eventId, int timeoutMs) throws IOException {
        ManagedServer server = servers.get(port);
        if (server == null) {
            throw new IOException("No TCP server running on port " + port);
        }

        if (eventId == null) {
            log.warn("waitForData called without eventId, this may cause data cross-talk!");
        }

        BlockingQueue<String> taskQueue = getTaskQueue(server, eventId);

        try {
            String msg = taskQueue.poll(timeoutMs, TimeUnit.MILLISECONDS);
            if (msg != null) {
                log.info("Received data for task {} on port {}: {}", 
                        eventId, port, abbreviate(msg, 100));
                return msg;
            }
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IOException("Interrupted while waiting for data");
        }

        log.info("Wait timeout for task {} on port {}", eventId, port);
        return null;
    }

    /**
     * 获取或创建指定任务的消息队列。
     */
    private BlockingQueue<String> getTaskQueue(ManagedServer server, String eventId) {
        if (eventId == null) {
            return server.messageQueue;
        }
        return server.taskQueues.computeIfAbsent(eventId, 
                k -> new LinkedBlockingQueue<>(1000));
    }

    /**
     * 将接收到的数据分发到对应的任务队列。
     * 策略：
     * 1. 如果有 eventId 对应的队列，放入该队列
     * 2. 同时也放入全局队列（兼容旧代码）
     */
    private void dispatchMessage(ManagedServer server, String message) {
        boolean dispatched = false;

        for (String eventId : server.taskQueues.keySet()) {
            try {
                BlockingQueue<String> queue = server.taskQueues.get(eventId);
                if (queue != null && queue.offer(message)) {
                    log.debug("Dispatched message to task queue: {}", eventId);
                    dispatched = true;
                }
            } catch (Exception e) {
                log.warn("Failed to dispatch message to task {}: {}", eventId, e.getMessage());
            }
        }

        try {
            server.messageQueue.offer(message);
        } catch (Exception e) {
            log.warn("Failed to dispatch message to global queue", e);
        }

        if (!dispatched && !server.taskQueues.isEmpty()) {
            log.warn("Message not dispatched to any task queue, " +
                    "active tasks: {}, message: {}", 
                    server.taskQueues.size(), abbreviate(message, 100));
        }
    }

    /**
     * 向特定索引的连接客户端发送数据。
     */
    public void sendToClient(int port, int clientIndex, String data) throws IOException {
        ManagedServer server = servers.get(port);
        if (server == null) {
            throw new IOException("No TCP server running on port " + port);
        }

        if (clientIndex < 0 || clientIndex >= server.clients.size()) {
            throw new IOException("Client index " + clientIndex + 
                    " out of range (connected: " + server.clients.size() + ")");
        }

        ClientConnection client = server.clients.get(clientIndex);
        byte[] bytes = (data + "\n").getBytes(StandardCharsets.UTF_8);
        client.socket.getOutputStream().write(bytes);
        client.socket.getOutputStream().flush();
    }

    /**
     * 获取给定端口上连接的客户端数量。
     */
    public int getClientCount(int port) {
        ManagedServer server = servers.get(port);
        return server != null ? server.clients.size() : 0;
    }

    /**
     * 检查服务器是否在给定端口上运行。
     */
    public boolean isRunning(int port) {
        return servers.containsKey(port);
    }

    /**
     * 停止给定端口上的 TCP 服务器。
     */
    public void stopServer(int port) {
        ManagedServer server = servers.remove(port);
        if (server == null) return;

        server.running = false;
        if (server.acceptThread != null) {
            server.acceptThread.interrupt();
        }

        for (ClientConnection client : server.clients) {
            closeQuietly(client.socket);
        }
        server.clients.clear();
        server.taskQueues.clear();

        closeQuietly(server.serverSocket);

        server.readExecutor.shutdownNow();

        log.info("TCP server stopped on port {}", port);
    }

    /**
     * 清理指定任务的队列，防止内存泄漏。
     * 任务完成后应该调用此方法。
     */
    public void cleanupTaskQueue(int port, String eventId) {
        if (eventId == null) return;
        
        ManagedServer server = servers.get(port);
        if (server != null) {
            BlockingQueue<String> removed = server.taskQueues.remove(eventId);
            if (removed != null) {
                log.info("Cleaned up task queue for eventId: {}, remaining messages: {}", 
                        eventId, removed.size());
            }
        }
    }

    @PreDestroy
    public void shutdown() {
        log.info("Shutting down all TCP servers...");
        for (Integer port : new ArrayList<>(servers.keySet())) {
            stopServer(port);
        }
    }

    private void acceptLoop(ManagedServer server) {
        log.info("Accept loop started for port {}", server.port);
        while (server.running) {
            try {
                Socket clientSocket = server.serverSocket.accept();
                clientSocket.setSoTimeout(100);
                ClientConnection conn = new ClientConnection(clientSocket,
                        clientSocket.getRemoteSocketAddress().toString());
                server.clients.add(conn);
                log.info("Client connected from {} on port {} (total: {})",
                        conn.address, server.port, server.clients.size());

                server.readExecutor.submit(() -> readFromClient(server, conn));
            } catch (SocketTimeoutException e) {
            } catch (IOException e) {
                if (server.running) {
                    log.error("Accept error on port {}: {}", server.port, e.getMessage());
                }
            }
        }
        log.info("Accept loop ended for port {}", server.port);
    }

    private void readFromClient(ManagedServer server, ClientConnection conn) {
        try {
            BufferedReader reader = new BufferedReader(
                    new InputStreamReader(conn.socket.getInputStream(), StandardCharsets.UTF_8));
            while (server.running && !conn.socket.isClosed()) {
                try {
                    String line = reader.readLine();
                    if (line == null) {
                        break;
                    }
                    line = line.trim();
                    if (!line.isEmpty()) {
                        log.info("Received from client {} on port {}: {}", 
                                conn.address, server.port, abbreviate(line, 100));
                        dispatchMessage(server, line);
                    }
                } catch (SocketTimeoutException e) {
                }
            }
        } catch (IOException e) {
            if (server.running) {
                log.debug("Client {} disconnected from port {}: {}", 
                        conn.address, server.port, e.getMessage());
            }
        } finally {
            server.clients.remove(conn);
            closeQuietly(conn.socket);
            log.info("Client {} removed from port {} (remaining: {})",
                    conn.address, server.port, server.clients.size());
        }
    }

    private static void closeQuietly(Closeable c) {
        try { if (c != null) c.close(); } catch (IOException ignored) {}
    }

    private static String abbreviate(String s, int max) {
        if (s == null) return "";
        return s.length() <= max ? s : s.substring(0, max) + "...";
    }

    private static class ManagedServer {
        final int port;
        final ServerSocket serverSocket;
        final CopyOnWriteArrayList<ClientConnection> clients = new CopyOnWriteArrayList<>();
        final LinkedBlockingQueue<String> messageQueue = new LinkedBlockingQueue<>(1000);
        final ConcurrentHashMap<String, BlockingQueue<String>> taskQueues = new ConcurrentHashMap<>();
        final ExecutorService readExecutor = Executors.newCachedThreadPool(r -> {
            Thread t = new Thread(r);
            t.setDaemon(true);
            return t;
        });
        volatile boolean running = true;
        Thread acceptThread;

        ManagedServer(int port, ServerSocket serverSocket) {
            this.port = port;
            this.serverSocket = serverSocket;
        }
    }

    private static class ClientConnection {
        final Socket socket;
        final String address;

        ClientConnection(Socket socket, String address) {
            this.socket = socket;
            this.address = address;
        }
    }
}
