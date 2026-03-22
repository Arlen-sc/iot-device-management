package com.iot.protocol.core;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ProtocolResponse {

    private boolean success;
    private Object data;
    private String errorMessage;
    private long timestamp;

    public static ProtocolResponse ok(Object data) {
        return ProtocolResponse.builder()
                .success(true)
                .data(data)
                .timestamp(System.currentTimeMillis())
                .build();
    }

    public static ProtocolResponse error(String msg) {
        return ProtocolResponse.builder()
                .success(false)
                .errorMessage(msg)
                .timestamp(System.currentTimeMillis())
                .build();
    }
}
