package com.iot.protocol.impl;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.iot.entity.Device;
import com.iot.entity.OperationType;
import com.iot.protocol.core.IoTProtocol;
import com.iot.protocol.core.ProtocolResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.*;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

import java.util.Map;

@Slf4j
@Component
public class HttpProtocol implements IoTProtocol {

    private static final String PROTOCOL_TYPE = "HTTP";

    private final RestTemplate restTemplate = new RestTemplate();
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Override
    public String getProtocolType() {
        return PROTOCOL_TYPE;
    }

    @Override
    public boolean connect(Device device) {
        try {
            Map<String, Object> config = parseConnectionConfig(device.getConnectionConfig());
            String baseUrl = (String) config.get("baseUrl");
            if (baseUrl == null || baseUrl.isBlank()) {
                log.error("HTTP connect failed: baseUrl is missing for device: {}", device.getName());
                return false;
            }
            log.info("HTTP protocol validated config for device: {}", device.getName());
            return true;
        } catch (Exception e) {
            log.error("Failed to validate HTTP config for device: {}", device.getName(), e);
            return false;
        }
    }

    @Override
    public void disconnect(Device device) {
        log.info("HTTP disconnect (no-op) for device: {}", device.getName());
    }

    @Override
    public boolean isConnected(Device device) {
        Map<String, Object> config = parseConnectionConfig(device.getConnectionConfig());
        String baseUrl = (String) config.get("baseUrl");
        return baseUrl != null && !baseUrl.isBlank();
    }

    @Override
    public ProtocolResponse executeOperation(Device device, OperationType operationType, Map<String, Object> params) {
        try {
            Map<String, Object> config = parseConnectionConfig(device.getConnectionConfig());
            String baseUrl = (String) config.get("baseUrl");
            String path = params != null ? (String) params.getOrDefault("path", "") : "";
            String url = baseUrl + path;

            HttpHeaders httpHeaders = buildHeaders(config);
            HttpEntity<Map<String, Object>> requestEntity = new HttpEntity<>(params, httpHeaders);

            ResponseEntity<Object> response = restTemplate.exchange(url, HttpMethod.POST, requestEntity, Object.class);

            log.info("HTTP POST to {} for device: {}, status: {}", url, device.getName(), response.getStatusCode());
            return ProtocolResponse.ok(response.getBody());
        } catch (Exception e) {
            log.error("Failed to execute HTTP operation for device: {}", device.getName(), e);
            return ProtocolResponse.error("HTTP operation failed: " + e.getMessage());
        }
    }

    @Override
    public ProtocolResponse readData(Device device, Map<String, Object> params) {
        try {
            Map<String, Object> config = parseConnectionConfig(device.getConnectionConfig());
            String baseUrl = (String) config.get("baseUrl");
            String path = params != null ? (String) params.getOrDefault("path", "") : "";
            String url = baseUrl + path;

            HttpHeaders httpHeaders = buildHeaders(config);
            HttpEntity<Void> requestEntity = new HttpEntity<>(httpHeaders);

            ResponseEntity<Object> response = restTemplate.exchange(url, HttpMethod.GET, requestEntity, Object.class);

            log.info("HTTP GET from {} for device: {}, status: {}", url, device.getName(), response.getStatusCode());
            return ProtocolResponse.ok(response.getBody());
        } catch (Exception e) {
            log.error("Failed to read HTTP data for device: {}", device.getName(), e);
            return ProtocolResponse.error("HTTP read failed: " + e.getMessage());
        }
    }

    @SuppressWarnings("unchecked")
    private HttpHeaders buildHeaders(Map<String, Object> config) {
        HttpHeaders httpHeaders = new HttpHeaders();
        httpHeaders.setContentType(MediaType.APPLICATION_JSON);

        Object headersObj = config.get("headers");
        if (headersObj instanceof Map) {
            Map<String, String> headers = (Map<String, String>) headersObj;
            headers.forEach(httpHeaders::set);
        }
        return httpHeaders;
    }

    private Map<String, Object> parseConnectionConfig(String connectionConfig) {
        try {
            if (connectionConfig != null && !connectionConfig.isBlank()) {
                return objectMapper.readValue(connectionConfig, new TypeReference<>() {});
            }
        } catch (Exception e) {
            log.error("Failed to parse HTTP connection config", e);
        }
        return Map.of();
    }

    @Override
    public String getDriverName() {
        return "HTTP Protocol Driver";
    }

    @Override
    public String getDriverVersion() {
        return "1.0.0";
    }

    @Override
    public void initialize(com.iot.protocol.core.DriverConfig config) throws com.iot.protocol.core.DriverException {
        log.info("HTTP protocol initialized");
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
        log.info("HTTP protocol destroyed");
    }
}
