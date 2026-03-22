package com.iot.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("device")
public class Device {

    @TableId(type = IdType.ASSIGN_ID)
    private Long id;

    private Long modelId;

    private String name;

    private String code;

    private Integer status;

    private String protocolType;

    private String connectionConfig;

    private String ipAddress;

    private Integer port;

    private String location;

    private String description;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;
}
