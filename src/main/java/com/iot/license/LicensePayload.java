package com.iot.license;

import lombok.Data;

import java.util.List;

/**
 * 授权码负载结构
 */
@Data
public class LicensePayload {

    /**
     * 协议版本
     */
    private Integer v;

    /**
     * 客户标识（可选）
     */
    private String customer;

    /**
     * 绑定机器码，可使用 * 表示不绑定
     */
    private String machineCode;

    /**
     * 过期时间（Epoch 秒）
     */
    private Long expireAt;

    /**
     * 授权码可激活截止时间（Epoch 秒）
     */
    private Long codeExpireAt;

    /**
     * 最大任务数量
     */
    private Integer maxTasks;

    /**
     * 功能列表
     */
    private List<String> features;

    /**
     * 签发时间（Epoch 秒）
     */
    private Long issuedAt;
}
