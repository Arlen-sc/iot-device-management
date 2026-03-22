package com.iot.task.node;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import jakarta.annotation.PostConstruct;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Slf4j
@Component
public class NodeHandlerRegistry {

    @Autowired(required = false)
    private List<NodeHandler> handlers;

    private final Map<String, NodeHandler> handlerMap = new HashMap<>();

    @PostConstruct
    public void init() {
        if (handlers != null) {
            for (NodeHandler handler : handlers) {
                handlerMap.put(handler.getType(), handler);
                log.info("Registered node handler: {}", handler.getType());
            }
        }
        log.info("NodeHandlerRegistry initialized with {} handlers", handlerMap.size());
    }

    public NodeHandler getHandler(String type) {
        return handlerMap.get(type);
    }
}
