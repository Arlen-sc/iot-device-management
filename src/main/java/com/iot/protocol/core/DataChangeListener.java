package com.iot.protocol.core;

import java.util.Map;

/**
 * 数据变化监听器
 * 用于监听设备数据的变化
 */
public interface DataChangeListener {
    
    /**
     * 当数据发生变化时调用
     * 
     * @param deviceId 设备ID
     * @param pointCode 点位编码
     * @param value 新的数值
     * @param timestamp 时间戳（毫秒）
     */
    void onDataChange(String deviceId, String pointCode, Object value, long timestamp);
    
    /**
     * 当批量数据发生变化时调用
     * 
     * @param deviceId 设备ID
     * @param dataMap 点位编码到数值的映射
     * @param timestamp 时间戳（毫秒）
     */
    default void onBatchDataChange(String deviceId, Map<String, Object> dataMap, long timestamp) {
        for (Map.Entry<String, Object> entry : dataMap.entrySet()) {
            onDataChange(deviceId, entry.getKey(), entry.getValue(), timestamp);
        }
    }
    
    /**
     * 当发生错误时调用
     * 
     * @param deviceId 设备ID
     * @param error 错误信息
     */
    default void onError(String deviceId, String error) {
    }
}
