package com.iot.task.node;

import lombok.Builder;
import lombok.Data;

import java.util.List;

@Data
@Builder
public class NodeResult {

    private boolean success;
    private Object outputData;
    private Object resultData;
    private List<String> nextNodeIds;
    private String errorMessage;

    public static NodeResult ok(Object data) {
        return NodeResult.builder()
                .success(true)
                .outputData(data)
                .resultData(data)
                .build();
    }

    public static NodeResult ok() {
        return NodeResult.builder()
                .success(true)
                .build();
    }

    public static NodeResult error(String msg) {
        return NodeResult.builder()
                .success(false)
                .errorMessage(msg)
                .build();
    }

    public static NodeResult branch(List<String> nodeIds) {
        return NodeResult.builder()
                .success(true)
                .nextNodeIds(nodeIds)
                .build();
    }
}
