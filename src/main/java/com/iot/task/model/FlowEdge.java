package com.iot.task.model;

import lombok.Data;

import java.util.Map;

@Data
public class FlowEdge {

    private String id;
    private String source;
    private String sourcePort;
    private String target;
    private String targetPort;
    private String label;
    private Map<String, Object> config;
}
