package com.iot.task.model;

import lombok.Data;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Data
public class FlowDefinition {

    private List<FlowNode> nodes;
    private List<FlowEdge> edges;
    private List<Map<String, Object>> variables;

    public FlowNode findNodeById(String id) {
        if (nodes == null || id == null) {
            return null;
        }
        return nodes.stream()
                .filter(n -> id.equals(n.getId()))
                .findFirst()
                .orElse(null);
    }

    public FlowNode findStartNode() {
        if (nodes == null) {
            return null;
        }
        return nodes.stream()
                .filter(n -> "START".equals(n.getType()))
                .findFirst()
                .orElse(null);
    }

    public List<FlowEdge> getOutgoingEdges(String nodeId) {
        if (edges == null || nodeId == null) {
            return Collections.emptyList();
        }
        return edges.stream()
                .filter(e -> nodeId.equals(e.getSource()))
                .collect(Collectors.toList());
    }

    public List<String> getTargetNodeIds(String nodeId) {
        return getOutgoingEdges(nodeId).stream()
                .map(FlowEdge::getTarget)
                .collect(Collectors.toList());
    }
}
