package com.iot.protocol.core;

import com.iot.entity.Device;
import com.iot.entity.OperationType;

import java.util.Map;

public interface IoTProtocol {

    String getProtocolType();

    boolean connect(Device device);

    void disconnect(Device device);

    boolean isConnected(Device device);

    ProtocolResponse executeOperation(Device device, OperationType operationType, Map<String, Object> params);

    ProtocolResponse readData(Device device, Map<String, Object> params);
}
