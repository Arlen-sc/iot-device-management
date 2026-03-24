package com.iot.service;

import java.util.Map;

/**
 * 软件授权服务接口
 */
public interface LicenseService {

    /**
     * 获取当前授权状态
     */
    Map<String, Object> getLicenseStatus();

    /**
     * 激活授权码
     */
    Map<String, Object> activateLicense(String licenseCode);

    /**
     * 校验指定功能是否可用
     */
    void assertFeatureAllowed(String featureCode, String featureName);

    /**
     * 校验任务数量是否超过授权上限
     */
    void assertTaskQuotaAllowed();
}
