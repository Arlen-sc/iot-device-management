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
 * Manages TCP server instances for flow execution.
 * Each server is identified by its port number.
 * Supports: start, broadcast to all clients, receive from any client, stop.
 */
@Slf4j
@Service
public class TcpServerManager {

    private final ConcurrentHashMap<Integer, ManagedServer> servers = new ConcurrentHashMap<>();

    /**
     * Start a TCP server on the given port (if not already running).
     */
    public synchronized void startServer(int port) throws IOException {
        if (servers.containsKey(port)) {
            log.info("TCP server already running on port {}", port);
            return;
        }

        ServerSocket serverSocket = new ServerSocket(port);
        serverSocket.setSoTimeout(500); // accept timeout for graceful shutdown
        ManagedServer server = new ManagedServer(port, serverSocket);
        servers.put(port, server);

        Thread acceptThread = new Thread(() -> acceptLoop(server), "tcp-server-accept-" + port);
        acceptThread.setDaemon(true);
        acceptThread.start();
        server.acceptThread = acceptThread;

        log.info("TCP server started on port {}", port);
    }

    /**
     * Broadcast data to all connected clients on the given port.
     */
    public int broadcast(int port, String data) throws IOException {
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

        // Cleanup dead clients
        for (ClientConnection dead : deadClients) {
            server.clients.remove(dead);
            closeQuietly(dead.socket);
        }

        log.info("Broadcast to {} clients on port {} ({} bytes)", sent, port, bytes.length);
        return sent;
    }

    /**
     * Wait for data from any connected client on the given port.
     * Returns the first message received within the timeout.
     */
    public String waitForData(int port, int timeoutMs) throws IOException {
        ManagedServer server = servers.get(port);
        if (server == null) {
            throw new IOException("No TCP server running on port " + port);
        }

        // Check the message queue first
        try {
            String msg = server.messageQueue.poll(timeoutMs, TimeUnit.MILLISECONDS);
            if (msg != null) {
                return msg;
            }
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IOException("Interrupted while waiting for data");
        }

        return null; // timeout
    }

    /**
     * Send data to a specific connected client by index.
     */
    public void sendToClient(int port, int clientIndex, String data) throws IOException {
        ManagedServer server = servers.get(port);
        if (server == null) {
            throw new IOException("No TCP server running on port " + port);
        }

        if (clientIndex < 0 || clientIndex >= server.clients.size()) {
            throw new IOException("Client index " + clientIndex + " out of range (connected: " + server.clients.size() + ")");
        }

        ClientConnection client = server.clients.get(clientIndex);
        byte[] bytes = (data + "\n").getBytes(StandardCharsets.UTF_8);
        client.socket.getOutputStream().write(bytes);
        client.socket.getOutputStream().flush();
    }

    /**
     * Get the number of connected clients on the given port.
     */
    public int getClientCount(int port) {
        ManagedServer server = servers.get(port);
        return server != null ? server.clients.size() : 0;
    }

    /**
     * Check if a server is running on the given port.
     */
    public boolean isRunning(int port) {
        return servers.containsKey(port);
    }

    /**
     * Stop the TCP server on the given port.
     */
    public void stopServer(int port) {
        ManagedServer server = servers.remove(port);
        if (server == null) return;

        server.running = false;
        if (server.acceptThread != null) {
            server.acceptThread.interrupt();
        }

        // Close all client connections
        for (ClientConnection client : server.clients) {
            closeQuietly(client.socket);
        }
        server.clients.clear();

        // Close server socket
        closeQuietly(server.serverSocket);

        // Shutdown read executors
        server.readExecutor.shutdownNow();

        log.info("TCP server stopped on port {}", port);
    }

    @PreDestroy
    public void shutdown() {
        log.info("Shutting down all TCP servers...");
        for (Integer port : new ArrayList<>(servers.keySet())) {
            stopServer(port);
        }
    }

    // ---- Internal ----

    private void acceptLoop(ManagedServer server) {
        log.info("Accept loop started for port {}", server.port);
        while (server.running) {
            try {
                Socket clientSocket = server.serverSocket.accept();
                clientSocket.setSoTimeout(100); // non-blocking reads
                ClientConnection conn = new ClientConnection(clientSocket,
                        clientSocket.getRemoteSocketAddress().toString());
                server.clients.add(conn);
                log.info("Client connected from {} on port {} (total: {})",
                        conn.address, server.port, server.clients.size());

                // Start reading from this client
                server.readExecutor.submit(() -> readFromClient(server, conn));
            } catch (SocketTimeoutException e) {
                // Normal - just loop back to check if still running
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
                        break; // Client disconnected
                    }
                    line = line.trim();
                    if (!line.isEmpty()) {
                        log.info("Received from client {} on port {}: {}", conn.address, server.port, line);
                        server.messageQueue.offer(line);
                    }
                } catch (SocketTimeoutException e) {
                    // Normal - just loop
                }
            }
        } catch (IOException e) {
            if (server.running) {
                log.debug("Client {} disconnected from port {}: {}", conn.address, server.port, e.getMessage());
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

    // ---- Inner classes ----

    private static class ManagedServer {
        final int port;
        final ServerSocket serverSocket;
        final CopyOnWriteArrayList<ClientConnection> clients = new CopyOnWriteArrayList<>();
        final LinkedBlockingQueue<String> messageQueue = new LinkedBlockingQueue<>(1000);
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
