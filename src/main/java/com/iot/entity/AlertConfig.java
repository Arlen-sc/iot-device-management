package com.iot.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("alert_config")
public class AlertConfig {

    @TableId(type = IdType.ASSIGN_ID)
    private Long id;

    private String name;

    private Long deviceId;

    @TableField("condition_json")
    private String conditionJson;

    @TableField("action_json")
    private String actionJson;

    private Integer status;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;
}
