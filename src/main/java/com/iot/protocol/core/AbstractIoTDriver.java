package com.iot.protocol.core;

import com.iot.entity.Device;
import com.iot.entity.OperationType;
import lombok.extern.slf4j.Slf4j;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.ThreadFactory;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.locks.ReentrantLock;

/**
 * 抽象驱动基类
 * 提供公共功能实现，包括：
 * - 驱动生命周期管理
 * - 连接管理和重连机制
 * - 监听器管理
 * - 线程池管理
 * - 批量操作默认实现
 */
@Slf4j
public abstract class AbstractIoTDriver implements IoTProtocol {
    
    protected DriverConfig config;
    protected DriverStatus status = DriverStatus.INITIALIZED;
    protected final Map<String, DeviceConnection> deviceConnections = new ConcurrentHashMap<>();
    protected final Map<String, List<DataChangeListener>> listeners = new ConcurrentHashMap<>();
    protected final ReentrantLock driverLock = new ReentrantLock();
    protected ExecutorService executorService;
    
    protected AbstractIoTDriver() {
    }
    
    @Override
    public void initialize(DriverConfig config) throws DriverException {
        this.config = config;
        this.status = DriverStatus.INITIALIZED;
        
        ThreadFactory threadFactory = new ThreadFactory() {
            private final AtomicInteger counter = new AtomicInteger(0);
            @Override
            public Thread newThread(Runnable r) {
                Thread t = new Thread(r);
                t.setName(getDriverName() + "-worker-" + counter.incrementAndGet());
                t.setDaemon(true);
                return t;
            }
        };
        
        this.executorService = Executors.newCachedThreadPool(threadFactory);
        
        doInitialize(config);
        log.info("Driver [{}] initialized successfully", getDriverName());
    }
    
    /**
     * 子类实现具体的初始化逻辑
     */
    protected abstract void doInitialize(DriverConfig config) throws DriverException;
    
    @Override
    public boolean connect(Device device) throws DriverException {
        driverLock.lock();
        try {
            String deviceKey = getDeviceKey(device);
            
            if (isConnected(device)) {
                log.warn("Device [{}] already connected", deviceKey);
                return true;
            }
            
            status = DriverStatus.CONNECTING;
            log.info("Connecting to device [{}]", deviceKey);
            
            DeviceConnection connection = new DeviceConnection();
            connection.device = device;
            connection.connected = doConnect(device, connection);
            
            if (connection.connected) {
                deviceConnections.put(deviceKey, connection);
                status = DriverStatus.CONNECTED;
                log.info("Device [{}] connected successfully", deviceKey);
                
                if (config.isAutoReconnect()) {
                    startHeartbeat(device);
                }
                
                return true;
            } else {
                status = DriverStatus.ERROR;
                log.error("Failed to connect to device [{}]", deviceKey);
                return false;
            }
        } finally {
            driverLock.unlock();
        }
    }
    
    /**
     * 子类实现具体的连接逻辑
     */
    protected abstract boolean doConnect(Device device, DeviceConnection connection) throws DriverException;
    
    @Override
    public void disconnect(Device device) throws DriverException {
        driverLock.lock();
        try {
            String deviceKey = getDeviceKey(device);
            DeviceConnection connection = deviceConnections.remove(deviceKey);
            
            if (connection != null) {
                status = DriverStatus.DISCONNECTING;
                stopHeartbeat(device);
                doDisconnect(device, connection);
                connection.connected = false;
                log.info("Device [{}] disconnected", deviceKey);
            }
            
            if (deviceConnections.isEmpty()) {
                status = DriverStatus.DISCONNECTED;
            }
        } finally {
            driverLock.unlock();
        }
    }
    
    /**
     * 子类实现具体的断开连接逻辑
     */
    protected abstract void doDisconnect(Device device, DeviceConnection connection) throws DriverException;
    
    @Override
    public boolean isConnected(Device device) {
        String deviceKey = getDeviceKey(device);
        DeviceConnection connection = deviceConnections.get(deviceKey);
        return connection != null && connection.connected;
    }
    
    @Override
    public DriverStatus getStatus() {
        return status;
    }
    
    @Override
    public List<ReadResult> batchRead(Device device, List<PointInfo> pointInfos) throws DriverException {
        List<ReadResult> results = new ArrayList<>();
        for (PointInfo pointInfo : pointInfos) {
            try {
                ReadResult result = read(device, pointInfo);
                results.add(result);
            } catch (Exception e) {
                results.add(ReadResult.error(pointInfo.getPointCode(), e.getMessage()));
            }
        }
        return results;
    }
    
    @Override
    public List<WriteResult> batchWrite(Device device, Map<PointInfo, Object> dataMap) throws DriverException {
        List<WriteResult> results = new ArrayList<>();
        for (Map.Entry<PointInfo, Object> entry : dataMap.entrySet()) {
            try {
                WriteResult result = write(device, entry.getKey(), entry.getValue());
                results.add(result);
            } catch (Exception e) {
                results.add(WriteResult.error(entry.getKey().getPointCode(), e.getMessage()));
            }
        }
        return results;
    }
    
    @Override
    public void subscribe(Device device, List<PointInfo> pointInfos, DataChangeListener listener) throws DriverException {
        String deviceKey = getDeviceKey(device);
        listeners.computeIfAbsent(deviceKey, k -> new ArrayList<>()).add(listener);
        doSubscribe(device, pointInfos, listener);
        log.info("Subscribed to device [{}] for {} points", deviceKey, pointInfos.size());
    }
    
    /**
     * 子类实现具体的订阅逻辑
     */
    protected abstract void doSubscribe(Device device, List<PointInfo> pointInfos, DataChangeListener listener) throws DriverException;
    
    @Override
    public void unsubscribe(Device device, List<PointInfo> pointInfos) throws DriverException {
        String deviceKey = getDeviceKey(device);
        listeners.remove(deviceKey);
        doUnsubscribe(device, pointInfos);
        log.info("Unsubscribed from device [{}]", deviceKey);
    }
    
    /**
     * 子类实现具体的取消订阅逻辑
     */
    protected abstract void doUnsubscribe(Device device, List<PointInfo> pointInfos) throws DriverException;
    
    /**
     * 通知数据变化
     */
    protected void notifyDataChange(String deviceId, String pointCode, Object value, long timestamp) {
        List<DataChangeListener> deviceListeners = listeners.get(deviceId);
        if (deviceListeners != null) {
            for (DataChangeListener listener : deviceListeners) {
                try {
                    listener.onDataChange(deviceId, pointCode, value, timestamp);
                } catch (Exception e) {
                    log.error("Error notifying listener", e);
                }
            }
        }
    }
    
    /**
     * 通知批量数据变化
     */
    protected void notifyBatchDataChange(String deviceId, Map<String, Object> dataMap, long timestamp) {
        List<DataChangeListener> deviceListeners = listeners.get(deviceId);
        if (deviceListeners != null) {
            for (DataChangeListener listener : deviceListeners) {
                try {
                    listener.onBatchDataChange(deviceId, dataMap, timestamp);
                } catch (Exception e) {
                    log.error("Error notifying listener", e);
                }
            }
        }
    }
    
    /**
     * 启动心跳
     */
    protected void startHeartbeat(Device device) {
        executorService.submit(() -> {
            String deviceKey = getDeviceKey(device);
            while (isConnected(device) && !Thread.currentThread().isInterrupted()) {
                try {
                    Thread.sleep(config.getHeartbeatInterval());
                    doHeartbeat(device);
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                    break;
                } catch (Exception e) {
                    log.warn("Heartbeat failed for device [{}]", deviceKey, e);
                    handleDisconnect(device);
                    break;
                }
            }
        });
    }
    
    /**
     * 停止心跳
     */
    protected void stopHeartbeat(Device device) {
    }
    
    /**
     * 子类实现心跳逻辑
     */
    protected void doHeartbeat(Device device) throws Exception {
    }
    
    /**
     * 处理断线重连
     */
    protected void handleDisconnect(Device device) {
        if (!config.isAutoReconnect()) {
            return;
        }
        
        executorService.submit(() -> {
            String deviceKey = getDeviceKey(device);
            int attempts = 0;
            
            while (attempts < config.getMaxReconnectAttempts() && !Thread.currentThread().isInterrupted()) {
                try {
                    log.info("Reconnecting to device [{}], attempt {}/{}", 
                            deviceKey, attempts + 1, config.getMaxReconnectAttempts());
                    
                    Thread.sleep(config.getReconnectInterval());
                    
                    if (connect(device)) {
                        log.info("Reconnected to device [{}] successfully", deviceKey);
                        return;
                    }
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                    break;
                } catch (Exception e) {
                    log.warn("Reconnection attempt failed for device [{}]", deviceKey, e);
                }
                attempts++;
            }
            
            log.error("Failed to reconnect to device [{}] after {} attempts", 
                    deviceKey, config.getMaxReconnectAttempts());
            status = DriverStatus.ERROR;
        });
    }
    
    @Override
    public void destroy() throws DriverException {
        driverLock.lock();
        try {
            log.info("Destroying driver [{}]", getDriverName());
            
            for (DeviceConnection connection : deviceConnections.values()) {
                try {
                    doDisconnect(connection.device, connection);
                } catch (Exception e) {
                    log.warn("Error disconnecting device", e);
                }
            }
            deviceConnections.clear();
            listeners.clear();
            
            doDestroy();
            
            if (executorService != null) {
                executorService.shutdown();
                try {
                    if (!executorService.awaitTermination(30, TimeUnit.SECONDS)) {
                        executorService.shutdownNow();
                    }
                } catch (InterruptedException e) {
                    executorService.shutdownNow();
                    Thread.currentThread().interrupt();
                }
            }
            
            status = DriverStatus.DESTROYED;
            log.info("Driver [{}] destroyed", getDriverName());
        } finally {
            driverLock.unlock();
        }
    }
    
    /**
     * 子类实现具体的销毁逻辑
     */
    protected abstract void doDestroy() throws DriverException;
    
    /**
     * 获取设备唯一标识
     */
    protected String getDeviceKey(Device device) {
        return device.getId() != null ? device.getId().toString() : 
               (device.getIpAddress() + ":" + device.getPort());
    }
    
    /**
     * 设备连接信息
     */
    protected static class DeviceConnection {
        Device device;
        boolean connected;
        long lastActiveTime;
        Object connection;
    }
}
