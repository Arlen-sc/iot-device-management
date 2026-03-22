package com.iot.task.model;

import lombok.Data;

import java.util.Map;

@Data
public class FlowNode {

    private String id;
    private String type;
    private String name;
    private Double x;
    private Double y;
    private Map<String, Object> config;
}
