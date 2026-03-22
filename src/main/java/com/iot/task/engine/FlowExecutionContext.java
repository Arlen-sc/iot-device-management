package com.iot.task.engine;

import com.iot.entity.Device;
import com.iot.util.VariablePathUtils;
import lombok.Data;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Data
public class FlowExecutionContext {

    private Map<String, Object> variables = new HashMap<>();
    private String flowConfigId;
    private String flowName;
    private boolean completed;
    private List<String> executionLog = new ArrayList<>();

    public void setVariable(String path, Object value) {
        VariablePathUtils.setValue(variables, path, value);
    }

    public Object getVariable(String path) {
        return VariablePathUtils.getValue(variables, path);
    }

    public void addLog(String message) {
        executionLog.add("[" + System.currentTimeMillis() + "] " + message);
    }

    public Device getDevice() {
        Object device = variables.get("currentDevice");
        if (device instanceof Device) {
            return (Device) device;
        }
        return null;
    }
}
