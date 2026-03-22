package com.iot.task.node.impl;

import com.iot.entity.Device;
import com.iot.entity.OperationType;
import com.iot.protocol.core.IoTProtocol;
import com.iot.protocol.core.ProtocolResponse;
import com.iot.protocol.manager.ProtocolManager;
import com.iot.service.DeviceService;
import com.iot.service.OperationTypeService;
import com.iot.task.engine.FlowExecutionContext;
import com.iot.task.model.FlowNode;
import com.iot.task.node.NodeHandler;
import com.iot.task.node.NodeResult;
import com.iot.util.VariablePathUtils;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.HashMap;
import java.util.Map;

@Slf4j
@Component
public class DeviceOperationNodeHandler implements NodeHandler {

    private final ProtocolManager protocolManager;
    private final DeviceService deviceService;
    private final OperationTypeService operationTypeService;

    public DeviceOperationNodeHandler(ProtocolManager protocolManager,
                                       DeviceService deviceService,
                                       OperationTypeService operationTypeService) {
        this.protocolManager = protocolManager;
        this.deviceService = deviceService;
        this.operationTypeService = operationTypeService;
    }

    @Override
    public String getType() {
        return "DEVICE_OPERATION";
    }

    @Override
    @SuppressWarnings("unchecked")
    public NodeResult execute(FlowNode node, FlowExecutionContext context) {
        try {
            Map<String, Object> config = node.getConfig();
            if (config == null) {
                return NodeResult.error("DEVICE_OPERATION node has no config");
            }

            // Resolve device
            Device device = resolveDevice(config, context);
            if (device == null) {
                return NodeResult.error("Device not found for DEVICE_OPERATION");
            }

            // Resolve operation type
            String operationTypeCode = (String) config.get("operationTypeCode");
            OperationType operationType = operationTypeService.lambdaQuery()
                    .eq(OperationType::getCode, operationTypeCode)
                    .one();

            if (operationType == null) {
                return NodeResult.error("Operation type not found: " + operationTypeCode);
            }

            // Resolve params with variable references
            Map<String, Object> rawParams = (Map<String, Object>) config.get("params");
            Map<String, Object> resolvedParams = resolveParams(rawParams, context);

            // Get protocol and execute
            String protocolType = device.getProtocolType();
            IoTProtocol protocol = protocolManager.getProtocol(protocolType);
            if (protocol == null) {
                return NodeResult.error("Protocol not found: " + protocolType);
            }

            log.info("Executing DEVICE_OPERATION node: {}, device: {}, operation: {}",
                    node.getName(), device.getName(), operationTypeCode);

            // Ensure connected
            if (!protocol.isConnected(device)) {
                protocol.connect(device);
            }

            ProtocolResponse response = protocol.executeOperation(device, operationType, resolvedParams);

            // Store result in context
            context.setVariable("deviceOperationResult", response.getData());
            context.setVariable("deviceOperationSuccess", response.isSuccess());
            context.addLog("Device operation " + operationTypeCode + " on device " +
                    device.getName() + ", success: " + response.isSuccess());

            if (response.isSuccess()) {
                return NodeResult.ok(response.getData());
            } else {
                return NodeResult.error("Device operation failed: " + response.getErrorMessage());
            }
        } catch (Exception e) {
            log.error("Error in DEVICE_OPERATION node: {}", node.getName(), e);
            return NodeResult.error("DEVICE_OPERATION node failed: " + e.getMessage());
        }
    }

    private Device resolveDevice(Map<String, Object> config, FlowExecutionContext context) {
        Object deviceIdObj = config.get("deviceId");

        if (deviceIdObj != null) {
            Long deviceId;
            if (deviceIdObj instanceof Number) {
                deviceId = ((Number) deviceIdObj).longValue();
            } else {
                String deviceIdStr = String.valueOf(deviceIdObj);
                if (deviceIdStr.startsWith("${") && deviceIdStr.endsWith("}")) {
                    String path = deviceIdStr.substring(2, deviceIdStr.length() - 1);
                    Object resolved = VariablePathUtils.getValue(context.getVariables(), path);
                    deviceId = resolved instanceof Number ? ((Number) resolved).longValue() : Long.parseLong(String.valueOf(resolved));
                } else {
                    deviceId = Long.parseLong(deviceIdStr);
                }
            }
            return deviceService.getById(deviceId);
        }

        return context.getDevice();
    }

    private Map<String, Object> resolveParams(Map<String, Object> rawParams, FlowExecutionContext context) {
        if (rawParams == null) {
            return new HashMap<>();
        }

        Map<String, Object> resolved = new HashMap<>();
        for (Map.Entry<String, Object> entry : rawParams.entrySet()) {
            Object value = entry.getValue();
            if (value instanceof String strValue) {
                if (strValue.startsWith("${") && strValue.endsWith("}")) {
                    String path = strValue.substring(2, strValue.length() - 1);
                    value = VariablePathUtils.getValue(context.getVariables(), path);
                }
            }
            resolved.put(entry.getKey(), value);
        }
        return resolved;
    }
}
