package com.iot.task.node;

import com.iot.task.model.FlowNode;
import com.iot.task.engine.FlowExecutionContext;

public interface NodeHandler {

    String getType();

    NodeResult execute(FlowNode node, FlowExecutionContext context);
}
