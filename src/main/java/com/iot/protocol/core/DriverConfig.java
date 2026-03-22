package com.iot.protocol.core;

import lombok.Data;

import java.util.HashMap;
import java.util.Map;

/**
 * 驱动配置类
 * 用于传递驱动初始化和运行时的配置参数
 */
@Data
public class DriverConfig {
    
    /**
     * 驱动实例ID
     */
    private String driverInstanceId;
    
    /**
     * 协议类型
     */
    private String protocolType;
    
    /**
     * 连接超时时间（毫秒）
     */
    private int connectTimeout = 30000;
    
    /**
     * 读取超时时间（毫秒）
     */
    private int readTimeout = 30000;
    
    /**
     * 写入超时时间（毫秒）
     */
    private int writeTimeout = 30000;
    
    /**
     * 重连间隔（毫秒）
     */
    private int reconnectInterval = 5000;
    
    /**
     * 最大重连次数
     */
    private int maxReconnectAttempts = 3;
    
    /**
     * 是否启用自动重连
     */
    private boolean autoReconnect = true;
    
    /**
     * 心跳间隔（毫秒）
     */
    private int heartbeatInterval = 30000;
    
    /**
     * 额外的自定义配置
     */
    private Map<String, Object> customConfig = new HashMap<>();
    
    /**
     * 获取自定义配置值
     */
    @SuppressWarnings("unchecked")
    public <T> T getConfig(String key, T defaultValue) {
        Object value = customConfig.get(key);
        if (value == null) {
            return defaultValue;
        }
        try {
            return (T) value;
        } catch (ClassCastException e) {
            return defaultValue;
        }
    }
    
    /**
     * 设置自定义配置值
     */
    public DriverConfig setConfig(String key, Object value) {
        customConfig.put(key, value);
        return this;
    }
}
