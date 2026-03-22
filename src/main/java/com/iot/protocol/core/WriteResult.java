package com.iot.protocol.core;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.HashMap;
import java.util.Map;

/**
 * 写入结果
 * 封装点位写入的结果信息
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class WriteResult {
    
    /**
     * 是否成功
     */
    private boolean success;
    
    /**
     * 点位编码
     */
    private String pointCode;
    
    /**
     * 写入的值
     */
    private Object writtenValue;
    
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
    public static WriteResult success(String pointCode, Object writtenValue) {
        return WriteResult.builder()
                .success(true)
                .pointCode(pointCode)
                .writtenValue(writtenValue)
                .timestamp(System.currentTimeMillis())
                .build();
    }
    
    /**
     * 创建失败结果
     */
    public static WriteResult error(String pointCode, String errorMessage) {
        return WriteResult.builder()
                .success(false)
                .pointCode(pointCode)
                .timestamp(System.currentTimeMillis())
                .errorMessage(errorMessage)
                .build();
    }
}
