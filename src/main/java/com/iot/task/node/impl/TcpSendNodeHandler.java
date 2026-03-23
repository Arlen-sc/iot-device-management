package com.iot.task.node.impl;

import org.springframework.stereotype.Component;

/**
 * 与 {@link TcpClientNodeHandler} 相同逻辑；设计器中的「TCP 发送」节点类型为 TCP_SEND。
 */
@Component
public class TcpSendNodeHandler extends TcpClientNodeHandler {

    @Override
    public String getType() {
        return "TCP_SEND";
    }
}
