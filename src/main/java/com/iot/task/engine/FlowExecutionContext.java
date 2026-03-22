package com.iot.task.engine;

import com.iot.entity.Device;
import com.iot.util.VariablePathUtils;
import lombok.Data;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;

@Data
public class FlowExecutionContext {

    private Map<String, Object> variables = new HashMap<>();
    private String flowConfigId;
    private String flowName;
    private String eventId;
    private boolean completed;
    private List<String> executionLog = new ArrayList<>();

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
        String timestamp = java.time.LocalDateTime.now().format(java.time.format.DateTimeFormatter.ofPattern("HH:mm:ss.SSS"));
        executionLog.add("[" + timestamp + "] " + message);
    }

    public Device getDevice() {
        Object device = variables.get("currentDevice");
        if (device instanceof Device) {
            return (Device) device;
        }
        return null;
    }
}
