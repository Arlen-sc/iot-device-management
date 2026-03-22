package com.iot.protocol.core;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

/**
 * 点位信息
 * 描述一个设备点位的元数据信息
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PointInfo {
    
    /**
     * 点位ID
     */
    private String pointId;
    
    /**
     * 点位编码
     */
    private String pointCode;
    
    /**
     * 点位名称
     */
    private String pointName;
    
    /**
     * 数据类型
     */
    private PointDataType dataType;
    
    /**
     * 寄存器地址（如果适用）
     */
    private String address;
    
    /**
     * 寄存器类型（如果适用）
     */
    private String registerType;
    
    /**
     * 偏移量
     */
    private int offset;
    
    /**
     * 数据长度
     */
    private int length;
    
    /**
     * 缩放因子
     */
    private BigDecimal scale;
    
    /**
     * 偏移值
     */
    private BigDecimal bias;
    
    /**
     * 单位
     */
    private String unit;
    
    /**
     * 描述
     */
    private String description;
    
    /**
     * 是否只读
     */
    private boolean readOnly;
    
    /**
     * 数据类型枚举
     */
    public enum PointDataType {
        BOOLEAN,
        INT16,
        UINT16,
        INT32,
        UINT32,
        INT64,
        UINT64,
        FLOAT32,
        FLOAT64,
        STRING,
        BYTES,
        ARRAY,
        OBJECT
    }
}
