package com.iot.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("task_flow_config")
public class TaskFlowConfig {

    @TableId(type = IdType.ASSIGN_ID)
    private Long id;

    private String name;

    private String description;

    private String flowType;

    private String triggerType;

    private String executionMode;

    private String cronExpression;

    private String startNodeConfig;

    @TableField("flow_json")
    private String flowJson;

    private Integer status;

    private Integer version;

    private String lastExecutionStatus;

    private LocalDateTime lastExecutionTime;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;
}
