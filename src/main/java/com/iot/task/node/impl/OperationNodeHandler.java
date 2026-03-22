package com.iot.task.node.impl;

import com.iot.task.engine.FlowExecutionContext;
import com.iot.task.model.FlowNode;
import com.iot.task.node.NodeHandler;
import com.iot.task.node.NodeResult;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.HashMap;
import java.util.Map;

/**
 * OPERATION node - executes an operation on the context device.
 *
 * @deprecated Use DEVICE_OPERATION instead. DEVICE_OPERATION supports both explicit deviceId
 *             and context-device modes. When no deviceId is configured, DEVICE_OPERATION
 *             behaves identically to OPERATION (uses the context device).
 *
 * This handler now delegates to {@link DeviceOperationNodeHandler} to avoid code duplication.
 * It translates the OPERATION config format (operationCode, params) into the
 * DEVICE_OPERATION config format (operationTypeCode, params) and forwards execution.
 */
@Slf4j
@Component
public class OperationNodeHandler implements NodeHandler {

    private final DeviceOperationNodeHandler deviceOperationNodeHandler;

    public OperationNodeHandler(DeviceOperationNodeHandler deviceOperationNodeHandler) {
        this.deviceOperationNodeHandler = deviceOperationNodeHandler;
    }

    @Override
    public String getType() {
        return "OPERATION";
    }

    @Override
    @SuppressWarnings("unchecked")
    public NodeResult execute(FlowNode node, FlowExecutionContext context) {
        log.info("OPERATION node '{}' delegating to DEVICE_OPERATION logic", node.getName());

        try {
            Map<String, Object> config = node.getConfig();
            if (config == null) {
                return NodeResult.error("OPERATION node has no config");
            }

            // Translate OPERATION config to DEVICE_OPERATION config format:
            //   OPERATION uses "operationCode", DEVICE_OPERATION uses "operationTypeCode"
            //   OPERATION has no deviceId (always uses context device)
            Map<String, Object> delegateConfig = new HashMap<>(config);
            String operationCode = (String) config.get("operationCode");
            if (operationCode != null && !delegateConfig.containsKey("operationTypeCode")) {
                delegateConfig.put("operationTypeCode", operationCode);
            }
            // Do not set deviceId - DeviceOperationNodeHandler.resolveDevice will fall back
            // to context.getDevice() when deviceId is absent, which is the OPERATION behavior.
            delegateConfig.remove("deviceId");

            // Create a wrapper FlowNode with the translated config
            FlowNode delegateNode = new FlowNode();
            delegateNode.setId(node.getId());
            delegateNode.setName(node.getName());
            delegateNode.setType("DEVICE_OPERATION");
            delegateNode.setConfig(delegateConfig);

            NodeResult result = deviceOperationNodeHandler.execute(delegateNode, context);

            // Also store results under the legacy OPERATION variable names for backward compatibility
            if (result.isSuccess()) {
                Object deviceOpResult = context.getVariables().get("deviceOperationResult");
                Object deviceOpSuccess = context.getVariables().get("deviceOperationSuccess");
                if (deviceOpResult != null) {
                    context.setVariable("operationResult", deviceOpResult);
                }
                if (deviceOpSuccess != null) {
                    context.setVariable("operationSuccess", deviceOpSuccess);
                }
            }

            return result;
        } catch (Exception e) {
            log.error("Error in OPERATION node: {}", node.getName(), e);
            return NodeResult.error("OPERATION node failed: " + e.getMessage());
        }
    }
}
