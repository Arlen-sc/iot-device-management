package com.iot.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("alert_record")
public class AlertRecord {

    @TableId(type = IdType.ASSIGN_ID)
    private Long id;

    private Long alertConfigId;

    private Long deviceId;

    private String level;

    private String message;

    @TableField("data_json")
    private String dataJson;

    private Integer status;

    private LocalDateTime triggeredAt;

    private LocalDateTime resolvedAt;
}
