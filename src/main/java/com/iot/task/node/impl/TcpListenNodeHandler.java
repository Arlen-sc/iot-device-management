package com.iot.task.node.impl;

import com.iot.task.engine.FlowExecutionContext;
import com.iot.task.model.FlowNode;
import com.iot.task.node.NodeHandler;
import com.iot.task.node.NodeResult;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.HashMap;
import java.util.Map;

/**
 * TCP_LISTEN node - connects to a TCP server and reads data (read-only TCP operation).
 *
 * This is a read-only subset of TCP_CLIENT. It now delegates to {@link TcpClientNodeHandler}
 * by setting sendData to empty and waitResponse to true.
 *
 * Config fields:
 *   host          - target IP/hostname  (e.g. "192.168.0.1")
 *   port          - target port         (e.g. 8002)
 *   timeout       - read timeout in ms  (default 5000)
 *   charset       - character encoding  (default UTF-8)
 *   readMode      - LINE | LENGTH | DELIMITER  (default LINE)
 *   readLength    - bytes to read when readMode=LENGTH
 *   delimiter     - stop character when readMode=DELIMITER
 *   outputVariable- variable name to store received string (default "tcpData")
 */
@Slf4j
@Component
public class TcpListenNodeHandler implements NodeHandler {

    private final TcpClientNodeHandler tcpClientNodeHandler;

    public TcpListenNodeHandler(TcpClientNodeHandler tcpClientNodeHandler) {
        this.tcpClientNodeHandler = tcpClientNodeHandler;
    }

    @Override
    public String getType() {
        return "TCP_LISTEN";
    }

    @Override
    public NodeResult execute(FlowNode node, FlowExecutionContext context) {
        log.info("TCP_LISTEN node '{}' delegating to TCP_CLIENT logic", node.getName());

        try {
            Map<String, Object> config = node.getConfig();
            if (config == null) {
                return NodeResult.error("TCP_LISTEN node has no config");
            }

            // Translate TCP_LISTEN config to TCP_CLIENT config:
            //   - No sendData (read-only)
            //   - Always wait for response
            //   - Default outputVariable is "tcpData" instead of "tcpClientData"
            Map<String, Object> delegateConfig = new HashMap<>(config);
            delegateConfig.put("sendData", "");
            delegateConfig.put("waitResponse", true);
            delegateConfig.put("sendHex", false);

            // Preserve TCP_LISTEN's default output variable name
            if (!config.containsKey("outputVariable")) {
                delegateConfig.put("outputVariable", "tcpData");
            }

            FlowNode delegateNode = new FlowNode();
            delegateNode.setId(node.getId());
            delegateNode.setName(node.getName());
            delegateNode.setType("TCP_CLIENT");
            delegateNode.setConfig(delegateConfig);

            return tcpClientNodeHandler.execute(delegateNode, context);
        } catch (Exception e) {
            log.error("TCP_LISTEN node '{}' failed: {}", node.getName(), e.getMessage(), e);
            context.addLog("TCP_LISTEN error: " + e.getMessage());
            return NodeResult.error("TCP_LISTEN failed: " + e.getMessage());
        }
    }
}
