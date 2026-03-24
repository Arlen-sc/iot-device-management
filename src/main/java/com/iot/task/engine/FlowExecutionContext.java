package com.iot.task.engine;

import com.iot.entity.Device;
import com.iot.util.VariablePathUtils;
import lombok.Data;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.atomic.AtomicInteger;

@Data
public class FlowExecutionContext {

    private Map<String, Object> variables = new HashMap<>();
    private String flowConfigId;
    private String flowName;
    /** 任务配置中的 flowType（如 TCP_CLIENT / TCP_SERVER / MIXED） */
    private String flowType;
    /** 任务配置中的 executionMode（如 SINGLE / BY_DEVICE） */
    private String executionMode;
    /**
     * 连续/轮询执行（如 startContinuousFlow）：为 true 时 TCP_SERVER 的 STOP 不关闭监听，避免重复创建服务。
     */
    private boolean continuousExecution;
    private String eventId;
    private boolean completed;
    private List<ExecutionLogEntry> executionLog = new CopyOnWriteArrayList<>();
    /** 当前线程正在执行的节点上下文（用于将 handler 内 addLog 自动归属到节点） */
    private final ThreadLocal<String> currentNodeTypeTL = new ThreadLocal<>();
    private final ThreadLocal<String> currentNodeNameTL = new ThreadLocal<>();

    /** Guards against infinite loops (e.g. TCP RECEIVE + CONDITION retry). */
    private final AtomicInteger executionStepCount = new AtomicInteger(0);

    /**
     * @return false if the maximum number of node executions has been exceeded
     */
    public boolean recordExecutionStep(int maxSteps) {
        return executionStepCount.incrementAndGet() <= maxSteps;
    }

    public void setVariable(String path, Object value) {
        VariablePathUtils.setValue(variables, path, value);
    }

    public Object getVariable(String path) {
        return VariablePathUtils.getValue(variables, path);
    }

    public void addLog(String message) {
        // 中文注释：优先绑定到当前节点；无节点上下文时回退为系统日志。
        String actionType = currentNodeTypeTL.get();
        String nodeName = currentNodeNameTL.get();
        if (actionType != null && nodeName != null) {
            addLog("INFO", message, actionType, nodeName, null, null);
            return;
        }
        addLog("SYSTEM", message, "SYSTEM", "System", null, null);
    }

    public void addLog(String message, String actionType, String nodeName) {
        addLog("INFO", message, actionType, nodeName, null, null);
    }

    public void addLog(String level, String message, String actionType, String nodeName, Object data, Long durationMs) {
        ExecutionLogEntry entry = new ExecutionLogEntry();
        entry.setTimestamp(java.time.LocalDateTime.now().format(java.time.format.DateTimeFormatter.ofPattern("HH:mm:ss.SSS")));
        entry.setLevel(level);
        entry.setMessage(message);
        entry.setActionType(actionType != null ? actionType : "-");
        entry.setNodeName(nodeName != null ? nodeName : "-");
        entry.setData(data);
        entry.setDurationMs(durationMs);
        executionLog.add(entry);
    }

    public void enterNodeLogScope(String nodeType, String nodeName) {
        currentNodeTypeTL.set(nodeType);
        currentNodeNameTL.set(nodeName);
    }

    public void exitNodeLogScope() {
        currentNodeTypeTL.remove();
        currentNodeNameTL.remove();
    }

    public Device getDevice() {
        Object device = variables.get("currentDevice");
        if (device instanceof Device) {
            return (Device) device;
        }
        return null;
    }
}
