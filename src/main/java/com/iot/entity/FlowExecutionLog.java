package com.iot.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("flow_execution_log")
public class FlowExecutionLog {

    @TableId(type = IdType.ASSIGN_ID)
    private Long id;

    private Long flowConfigId;

    private String flowName;

    // private String eventId;

    private String nodeId;

    private String nodeName;

    @TableField("action_type")
    private String actionType;

    private String level;

    private String message;

    @TableField("data_json")
    private String dataJson;

    private LocalDateTime createdAt;
}
