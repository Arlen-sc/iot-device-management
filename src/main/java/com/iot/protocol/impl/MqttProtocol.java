package com.iot.protocol.impl;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.iot.entity.Device;
import com.iot.entity.OperationType;
import com.iot.protocol.core.IoTProtocol;
import com.iot.protocol.core.ProtocolResponse;
import lombok.extern.slf4j.Slf4j;
import org.eclipse.paho.client.mqttv3.*;
import org.eclipse.paho.client.mqttv3.persist.MemoryPersistence;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;

@Slf4j
@Component
public class MqttProtocol implements IoTProtocol {

    private static final String PROTOCOL_TYPE = "MQTT";
    private static final long READ_TIMEOUT_SECONDS = 10;

    private final ConcurrentHashMap<String, MqttClient> clientMap = new ConcurrentHashMap<>();
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Override
    public String getProtocolType() {
        return PROTOCOL_TYPE;
    }

    @Override
    public boolean connect(Device device) {
        try {
            Map<String, Object> config = parseConnectionConfig(device.getConnectionConfig());
            String brokerUrl = (String) config.get("brokerUrl");
            String clientId = (String) config.getOrDefault("clientId", "iot-client-" + device.getId());

            MqttClient client = new MqttClient(brokerUrl, clientId, new MemoryPersistence());
            MqttConnectOptions options = new MqttConnectOptions();
            options.setCleanSession(true);
            options.setConnectionTimeout(10);
            options.setKeepAliveInterval(60);

            if (config.containsKey("username")) {
                options.setUserName((String) config.get("username"));
            }
            if (config.containsKey("password")) {
                options.setPassword(((String) config.get("password")).toCharArray());
            }

            client.connect(options);
            clientMap.put(getDeviceKey(device), client);
            log.info("MQTT connected to device: {} at {}", device.getName(), brokerUrl);
            return true;
        } catch (Exception e) {
            log.error("Failed to connect MQTT device: {}", device.getName(), e);
            return false;
        }
    }

    @Override
    public void disconnect(Device device) {
        String key = getDeviceKey(device);
        MqttClient client = clientMap.remove(key);
        if (client != null) {
            try {
                if (client.isConnected()) {
                    client.disconnect();
                }
                client.close();
                log.info("MQTT disconnected from device: {}", device.getName());
            } catch (MqttException e) {
                log.error("Error disconnecting MQTT device: {}", device.getName(), e);
            }
        }
    }

    @Override
    public boolean isConnected(Device device) {
        MqttClient client = clientMap.get(getDeviceKey(device));
        return client != null && client.isConnected();
    }

    @Override
    public ProtocolResponse executeOperation(Device device, OperationType operationType, Map<String, Object> params) {
        try {
            MqttClient client = getOrConnect(device);
            if (client == null || !client.isConnected()) {
                return ProtocolResponse.error("MQTT client not connected for device: " + device.getName());
            }

            Map<String, Object> config = parseConnectionConfig(device.getConnectionConfig());
            String topic = (String) config.getOrDefault("topic", "iot/device/" + device.getCode() + "/command");

            if (params != null && params.containsKey("topic")) {
                topic = (String) params.get("topic");
            }

            String payload = objectMapper.writeValueAsString(params);
            int qos = params != null && params.containsKey("qos") ? ((Number) params.get("qos")).intValue() : 1;

            MqttMessage message = new MqttMessage(payload.getBytes(StandardCharsets.UTF_8));
            message.setQos(qos);
            client.publish(topic, message);

            log.info("MQTT message published to topic: {} for device: {}", topic, device.getName());
            return ProtocolResponse.ok("Message published to topic: " + topic);
        } catch (Exception e) {
            log.error("Failed to execute MQTT operation for device: {}", device.getName(), e);
            return ProtocolResponse.error("MQTT operation failed: " + e.getMessage());
        }
    }

    @Override
    public ProtocolResponse readData(Device device, Map<String, Object> params) {
        try {
            MqttClient client = getOrConnect(device);
            if (client == null || !client.isConnected()) {
                return ProtocolResponse.error("MQTT client not connected for device: " + device.getName());
            }

            Map<String, Object> config = parseConnectionConfig(device.getConnectionConfig());
            String topic = (String) config.getOrDefault("topic", "iot/device/" + device.getCode() + "/data");

            if (params != null && params.containsKey("topic")) {
                topic = (String) params.get("topic");
            }

            int qos = params != null && params.containsKey("qos") ? ((Number) params.get("qos")).intValue() : 1;

            CompletableFuture<String> future = new CompletableFuture<>();
            String subscribeTopic = topic;

            client.subscribe(subscribeTopic, qos, (t, msg) -> {
                String payload = new String(msg.getPayload(), StandardCharsets.UTF_8);
                future.complete(payload);
            });

            try {
                String result = future.get(READ_TIMEOUT_SECONDS, TimeUnit.SECONDS);
                client.unsubscribe(subscribeTopic);
                log.info("MQTT data received from topic: {} for device: {}", subscribeTopic, device.getName());

                try {
                    Object parsed = objectMapper.readValue(result, Object.class);
                    return ProtocolResponse.ok(parsed);
                } catch (Exception e) {
                    return ProtocolResponse.ok(result);
                }
            } catch (Exception e) {
                client.unsubscribe(subscribeTopic);
                return ProtocolResponse.error("MQTT read timeout after " + READ_TIMEOUT_SECONDS + " seconds");
            }
        } catch (Exception e) {
            log.error("Failed to read MQTT data for device: {}", device.getName(), e);
            return ProtocolResponse.error("MQTT read failed: " + e.getMessage());
        }
    }

    private MqttClient getOrConnect(Device device) {
        String key = getDeviceKey(device);
        MqttClient client = clientMap.get(key);
        if (client == null || !client.isConnected()) {
            connect(device);
            client = clientMap.get(key);
        }
        return client;
    }

    private String getDeviceKey(Device device) {
        return "mqtt-" + device.getId();
    }

    private Map<String, Object> parseConnectionConfig(String connectionConfig) {
        try {
            if (connectionConfig != null && !connectionConfig.isBlank()) {
                return objectMapper.readValue(connectionConfig, new TypeReference<>() {});
            }
        } catch (Exception e) {
            log.error("Failed to parse MQTT connection config", e);
        }
        return Map.of();
    }

    @Override
    public String getDriverName() {
        return "MQTT Protocol Driver";
    }

    @Override
    public String getDriverVersion() {
        return "1.0.0";
    }

    @Override
    public void initialize(com.iot.protocol.core.DriverConfig config) throws com.iot.protocol.core.DriverException {
        log.info("MQTT protocol initialized");
    }

    @Override
    public com.iot.protocol.core.DriverStatus getStatus() {
        return com.iot.protocol.core.DriverStatus.RUNNING;
    }

    @Override
    public com.iot.protocol.core.ReadResult read(com.iot.entity.Device device, com.iot.protocol.core.PointInfo pointInfo) throws com.iot.protocol.core.DriverException {
        throw new UnsupportedOperationException("Not implemented yet");
    }

    @Override
    public java.util.List<com.iot.protocol.core.ReadResult> batchRead(com.iot.entity.Device device, java.util.List<com.iot.protocol.core.PointInfo> pointInfos) throws com.iot.protocol.core.DriverException {
        throw new UnsupportedOperationException("Not implemented yet");
    }

    @Override
    public com.iot.protocol.core.WriteResult write(com.iot.entity.Device device, com.iot.protocol.core.PointInfo pointInfo, Object value) throws com.iot.protocol.core.DriverException {
        throw new UnsupportedOperationException("Not implemented yet");
    }

    @Override
    public java.util.List<com.iot.protocol.core.WriteResult> batchWrite(com.iot.entity.Device device, java.util.Map<com.iot.protocol.core.PointInfo, Object> dataMap) throws com.iot.protocol.core.DriverException {
        throw new UnsupportedOperationException("Not implemented yet");
    }

    @Override
    public void subscribe(com.iot.entity.Device device, java.util.List<com.iot.protocol.core.PointInfo> pointInfos, com.iot.protocol.core.DataChangeListener listener) throws com.iot.protocol.core.DriverException {
        throw new UnsupportedOperationException("Not implemented yet");
    }

    @Override
    public void unsubscribe(com.iot.entity.Device device, java.util.List<com.iot.protocol.core.PointInfo> pointInfos) throws com.iot.protocol.core.DriverException {
        throw new UnsupportedOperationException("Not implemented yet");
    }

    @Override
    public void destroy() throws com.iot.protocol.core.DriverException {
        clientMap.forEach((key, client) -> {
            try {
                if (client.isConnected()) {
                    client.disconnect();
                }
                client.close();
            } catch (Exception e) {
                log.error("Error closing MQTT client: {}", key, e);
            }
        });
        clientMap.clear();
        log.info("MQTT protocol destroyed, all clients closed");
    }
}
