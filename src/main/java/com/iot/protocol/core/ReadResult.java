package com.iot.protocol.core;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.HashMap;
import java.util.Map;

/**
 * 读取结果
 * 封装点位读取的结果信息
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ReadResult {
    
    /**
     * 是否成功
     */
    private boolean success;
    
    /**
     * 点位编码
     */
    private String pointCode;
    
    /**
     * 读取的值
     */
    private Object value;
    
    /**
     * 数据质量标识
     */
    private DataQuality quality;
    
    /**
     * 时间戳（毫秒）
     */
    private long timestamp;
    
    /**
     * 错误信息（如果失败）
     */
    private String errorMessage;
    
    /**
     * 额外信息
     */
    private Map<String, Object> extra = new HashMap<>();
    
    /**
     * 创建成功结果
     */
    public static ReadResult success(String pointCode, Object value) {
        return ReadResult.builder()
                .success(true)
                .pointCode(pointCode)
                .value(value)
                .quality(DataQuality.GOOD)
                .timestamp(System.currentTimeMillis())
                .build();
    }
    
    /**
     * 创建失败结果
     */
    public static ReadResult error(String pointCode, String errorMessage) {
        return ReadResult.builder()
                .success(false)
                .pointCode(pointCode)
                .quality(DataQuality.BAD)
                .timestamp(System.currentTimeMillis())
                .errorMessage(errorMessage)
                .build();
    }
    
    /**
     * 数据质量枚举
     */
    public enum DataQuality {
        /**
         * 良好
         */
        GOOD,
        
        /**
         * 不确定
         */
        UNCERTAIN,
        
        /**
         * 错误
         */
        BAD,
        
        /**
         * 配置错误
         */
        CONFIG_ERROR,
        
        /**
         * 设备未连接
         */
        NOT_CONNECTED,
        
        /**
         * 超时
         */
        TIMEOUT
    }
}
