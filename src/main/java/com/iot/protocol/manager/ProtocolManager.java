package com.iot.protocol.manager;

import com.iot.protocol.core.IoTProtocol;
import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Slf4j
@Component
public class ProtocolManager {

    @Autowired(required = false)
    private List<IoTProtocol> protocols;

    private final Map<String, IoTProtocol> protocolMap = new HashMap<>();

    @PostConstruct
    public void init() {
        if (protocols != null) {
            for (IoTProtocol protocol : protocols) {
                protocolMap.put(protocol.getProtocolType(), protocol);
                log.info("Registered IoT protocol: {}", protocol.getProtocolType());
            }
        }
        log.info("ProtocolManager initialized with {} protocols", protocolMap.size());
    }

    public IoTProtocol getProtocol(String type) {
        return protocolMap.get(type);
    }

    public Set<String> getSupportedProtocols() {
        return Collections.unmodifiableSet(protocolMap.keySet());
    }
}
