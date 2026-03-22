package com.iot.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("data_bridge")
public class DataBridge {

    @TableId(type = IdType.ASSIGN_ID)
    private Long id;

    private String name;

    private String sourceType;

    private String sourceConfig;

    private String targetType;

    private String targetConfig;

    @TableField("mapping_json")
    private String mappingJson;

    private Integer status;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;
}
