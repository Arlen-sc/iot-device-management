package com.iot.task.engine;

import lombok.Data;

@Data
public class ExecutionLogEntry {
    private String timestamp;
    private String level;       // INFO, WARN, ERROR, SYSTEM
    private String actionType;
    private String nodeName;
    private String message;
    private Object data;        // 附加数据 (如输入输出变量)
    private Long durationMs;    // 执行耗时
}
