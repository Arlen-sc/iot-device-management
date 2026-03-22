package com.iot.protocol.core;

/**
 * 驱动状态枚举
 * 定义驱动生命周期中的各种状态
 */
public enum DriverStatus {
    
    /**
     * 初始状态
     */
    INITIALIZED("初始化完成"),
    
    /**
     * 正在连接
     */
    CONNECTING("正在连接"),
    
    /**
     * 已连接
     */
    CONNECTED("已连接"),
    
    /**
     * 正在断开连接
     */
    DISCONNECTING("正在断开连接"),
    
    /**
     * 已断开连接
     */
    DISCONNECTED("已断开连接"),
    
    /**
     * 运行中
     */
    RUNNING("运行中"),
    
    /**
     * 错误状态
     */
    ERROR("错误"),
    
    /**
     * 已销毁
     */
    DESTROYED("已销毁");
    
    private final String description;
    
    DriverStatus(String description) {
        this.description = description;
    }
    
    public String getDescription() {
        return description;
    }
}
