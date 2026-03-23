package com.iot.task.model;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * 将设计器保存的 AntV X6 画布 JSON（含 {@code cells}）转为引擎使用的 {@link FlowDefinition}（{@code nodes}+{@code edges}）。
 */
public final class FlowJsonSupport {

    private FlowJsonSupport() {}

    public static FlowDefinition parseFlowDefinition(String flowJson, ObjectMapper mapper) throws IOException {
        if (flowJson == null || flowJson.isBlank()) {
            return new FlowDefinition();
        }
        JsonNode root = mapper.readTree(flowJson);
        if (root.has("nodes") && root.get("nodes").isArray() && root.get("nodes").size() > 0) {
            return mapper.readValue(flowJson, FlowDefinition.class);
        }
        if (root.has("cells") && root.get("cells").isArray()) {
            FlowDefinition fd = fromX6Cells(root, mapper);
            if (root.has("variables") && root.get("variables").isArray()) {
                fd.setVariables(mapper.convertValue(root.get("variables"), new TypeReference<List<Map<String, Object>>>() {}));
            }
            return fd;
        }
        return mapper.readValue(flowJson, FlowDefinition.class);
    }

    private static FlowDefinition fromX6Cells(JsonNode root, ObjectMapper mapper) {
        JsonNode cells = root.get("cells");
        List<FlowNode> nodes = new ArrayList<>();
        List<FlowEdge> edges = new ArrayList<>();

        for (JsonNode cell : cells) {
            if (cell == null || !cell.isObject()) {
                continue;
            }
            String shape = text(cell, "shape");
            if (isEdgeShape(shape, cell)) {
                FlowEdge e = new FlowEdge();
                if (cell.has("id")) {
                    e.setId(cell.get("id").asText());
                }
                String src = extractEndpointCellId(cell.get("source"));
                String tgt = extractEndpointCellId(cell.get("target"));
                e.setSource(src);
                e.setTarget(tgt);
                if (cell.has("source") && cell.get("source").isObject()) {
                    JsonNode s = cell.get("source");
                    if (s.has("port")) {
                        e.setSourcePort(s.get("port").asText());
                    }
                }
                if (cell.has("target") && cell.get("target").isObject()) {
                    JsonNode t = cell.get("target");
                    if (t.has("port")) {
                        e.setTargetPort(t.get("port").asText());
                    }
                }
                if (src != null && tgt != null) {
                    edges.add(e);
                }
                continue;
            }

            FlowNode n = new FlowNode();
            if (cell.has("id")) {
                n.setId(cell.get("id").asText());
            }
            JsonNode data = cell.get("data");
            String nodeType = "";
            Map<String, Object> config = null;
            if (data != null && data.has("type")) {
                nodeType = data.get("type").asText();
            }
            if (nodeType == null || nodeType.isEmpty()) {
                if ("start-node".equals(shape)) {
                    nodeType = "START";
                } else if ("end-node".equals(shape)) {
                    nodeType = "END";
                }
            }
            if (nodeType != null && !nodeType.isEmpty()) {
                n.setType(nodeType.toUpperCase(Locale.ROOT));
            }
            if (data != null && data.has("config")) {
                JsonNode cfg = data.get("config");
                if (cfg != null && !cfg.isNull()) {
                    config = mapper.convertValue(cfg, new TypeReference<Map<String, Object>>() {});
                    n.setConfig(config);
                }
            }
            String name = null;
            if (config != null && config.get("name") != null) {
                name = String.valueOf(config.get("name"));
            }
            if ((name == null || name.isBlank()) && cell.has("attrs")) {
                JsonNode label = cell.get("attrs").get("label");
                if (label != null && label.has("text")) {
                    name = label.get("text").asText();
                }
            }
            n.setName(name != null && !name.isBlank() ? name : (n.getType() != null ? n.getType() : "node"));

            if (cell.has("position")) {
                JsonNode pos = cell.get("position");
                if (pos.has("x")) {
                    n.setX(pos.get("x").asDouble());
                }
                if (pos.has("y")) {
                    n.setY(pos.get("y").asDouble());
                }
            }
            if (n.getId() != null && n.getType() != null && !n.getType().isEmpty()) {
                nodes.add(n);
            }
        }

        FlowDefinition fd = new FlowDefinition();
        fd.setNodes(nodes);
        fd.setEdges(edges);
        return fd;
    }

    private static boolean isEdgeShape(String shape, JsonNode cell) {
        if (shape != null && shape.toLowerCase(Locale.ROOT).contains("edge")) {
            return true;
        }
        // 无 shape 的连线：有 source/target，且画布节点通常带 position
        return cell.has("source") && cell.has("target") && !cell.has("position");
    }

    private static String extractEndpointCellId(JsonNode endpoint) {
        if (endpoint == null || endpoint.isNull()) {
            return null;
        }
        if (endpoint.isTextual()) {
            return endpoint.asText();
        }
        if (endpoint.isObject() && endpoint.has("cell")) {
            return endpoint.get("cell").asText();
        }
        return null;
    }

    private static String text(JsonNode obj, String field) {
        if (obj != null && obj.has(field) && !obj.get(field).isNull()) {
            return obj.get(field).asText();
        }
        return null;
    }
}
