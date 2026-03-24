package com.iot.service.impl;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.iot.entity.SoftwareLicense;
import com.iot.license.LicenseCryptoUtil;
import com.iot.license.LicenseFeatures;
import com.iot.license.LicensePayload;
import com.iot.mapper.SoftwareLicenseMapper;
import com.iot.mapper.TaskFlowConfigMapper;
import com.iot.service.LicenseService;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;

/**
 * 软件授权服务实现
 */
@Service
@RequiredArgsConstructor
public class LicenseServiceImpl implements LicenseService {

    private static final long SINGLE_LICENSE_ID = 1L;
    private static final int ACTIVE_STATUS = 1;

    private final SoftwareLicenseMapper softwareLicenseMapper;
    private final TaskFlowConfigMapper taskFlowConfigMapper;
    private final ObjectMapper objectMapper;

    @Value("${license.secret:IOT-LICENSE-SECRET-CHANGE-ME}")
    private String licenseSecret;

    @Value("${license.trial-days:7}")
    private int trialDays;

    /**
     * 获取授权状态并返回给前端
     */
    @Override
    public Map<String, Object> getLicenseStatus() {
        SoftwareLicense current = ensureLicenseRecord();
        LocalDateTime now = LocalDateTime.now();
        boolean expired = current.getExpireAt() != null && now.isAfter(current.getExpireAt());
        boolean machineMatched = machineMatches(current.getMachineCode());
        boolean valid = !expired && machineMatched;
        long currentTasks = safeTaskCount();
        int maxTasks = current.getMaxTasks() == null ? 0 : current.getMaxTasks();
        long remainingDays = current.getExpireAt() == null ? 0
            : Math.max(0, Duration.between(now, current.getExpireAt()).toDays());
        List<String> features = parseFeatures(current.getFeaturesJson());
        String mode = current.getStatus() != null && current.getStatus() == ACTIVE_STATUS ? "LICENSED" : "TRIAL";

        String message;
        if (expired) {
            message = "授权已过期，请联系管理员续期";
        } else if (!machineMatched) {
            message = "授权与当前机器不匹配";
        } else if ("TRIAL".equals(mode)) {
            message = "当前为试用授权，请尽快激活正式授权码";
        } else {
            message = "授权有效";
        }

        return Map.of(
            "mode", mode,
            "valid", valid,
            "machineCode", LicenseCryptoUtil.buildMachineCode(),
            "expireAt", current.getExpireAt(),
            "remainingDays", remainingDays,
            "maxTasks", maxTasks,
            "currentTasks", currentTasks,
            "features", features,
            "message", message
        );
    }

    /**
     * 激活正式授权码并替换当前授权
     */
    @Override
    public Map<String, Object> activateLicense(String licenseCode) {
        if (licenseCode == null || licenseCode.isBlank()) {
            throw new IllegalArgumentException("授权码不能为空");
        }

        LicensePayload payload = LicenseCryptoUtil.verifyAndParse(licenseCode.trim(), licenseSecret);
        validatePayload(payload);

        String currentMachine = LicenseCryptoUtil.buildMachineCode();
        String payloadMachine = payload.getMachineCode() == null ? "" : payload.getMachineCode().trim().toUpperCase();
        if (!"*".equals(payloadMachine) && !payloadMachine.equals(currentMachine)) {
            throw new IllegalArgumentException("授权码机器码与当前设备不匹配");
        }

        LocalDateTime expireAt = LocalDateTime.ofEpochSecond(payload.getExpireAt(), 0, ZoneOffset.UTC);
        SoftwareLicense updated = ensureLicenseRecord();
        updated.setId(SINGLE_LICENSE_ID);
        updated.setStatus(ACTIVE_STATUS);
        updated.setLicenseCode(licenseCode.trim());
        updated.setMachineCode(payloadMachine);
        updated.setExpireAt(expireAt);
        updated.setMaxTasks(payload.getMaxTasks());
        updated.setFeaturesJson(writeFeatures(payload.getFeatures()));
        updated.setActivatedAt(LocalDateTime.now());
        softwareLicenseMapper.updateById(updated);

        return getLicenseStatus();
    }

    /**
     * 校验功能是否被授权
     */
    @Override
    public void assertFeatureAllowed(String featureCode, String featureName) {
        SoftwareLicense current = ensureLicenseRecord();
        assertCommonValid(current);

        List<String> features = parseFeatures(current.getFeaturesJson());
        if (!isFeatureAllowed(features, featureCode)) {
            throw new IllegalStateException("当前授权不包含“" + featureName + "”功能");
        }
    }

    /**
     * 校验任务数量是否超过授权上限
     */
    @Override
    public void assertTaskQuotaAllowed() {
        SoftwareLicense current = ensureLicenseRecord();
        assertCommonValid(current);

        int maxTasks = current.getMaxTasks() == null ? 0 : current.getMaxTasks();
        long usedTasks = safeTaskCount();
        if (usedTasks >= maxTasks) {
            throw new IllegalStateException("当前授权最多允许 " + maxTasks + " 个任务，请升级授权或删除历史任务");
        }
    }

    /**
     * 确保授权记录存在，不存在则自动生成试用授权
     */
    private SoftwareLicense ensureLicenseRecord() {
        SoftwareLicense current = softwareLicenseMapper.selectById(SINGLE_LICENSE_ID);
        if (current != null) {
            return current;
        }

        SoftwareLicense trial = new SoftwareLicense();
        trial.setId(SINGLE_LICENSE_ID);
        trial.setStatus(0);
        trial.setLicenseCode("TRIAL");
        trial.setMachineCode(LicenseCryptoUtil.buildMachineCode());
        trial.setExpireAt(LocalDateTime.now().plusDays(trialDays));
        trial.setMaxTasks(3);
        trial.setFeaturesJson(writeFeatures(List.of(
            LicenseFeatures.TASK_MANAGEMENT,
            LicenseFeatures.FLOW_DESIGN
        )));
        trial.setCreatedAt(LocalDateTime.now());
        trial.setUpdatedAt(LocalDateTime.now());
        softwareLicenseMapper.insert(trial);
        return trial;
    }

    /**
     * 校验授权通用有效性（过期与机器码）
     */
    private void assertCommonValid(SoftwareLicense current) {
        LocalDateTime now = LocalDateTime.now();
        if (current.getExpireAt() != null && now.isAfter(current.getExpireAt())) {
            throw new IllegalStateException("授权已过期，请先续期后再操作");
        }
        if (!machineMatches(current.getMachineCode())) {
            throw new IllegalStateException("授权与当前机器不匹配");
        }
    }

    /**
     * 机器码匹配校验
     */
    private boolean machineMatches(String licenseMachineCode) {
        if (licenseMachineCode == null || licenseMachineCode.isBlank()) {
            return false;
        }
        String target = licenseMachineCode.trim().toUpperCase();
        if ("*".equals(target)) {
            return true;
        }
        return target.equals(LicenseCryptoUtil.buildMachineCode());
    }

    /**
     * 安全获取任务数量，避免异常中断授权接口
     */
    private long safeTaskCount() {
        try {
            Long count = taskFlowConfigMapper.selectCount(null);
            return count == null ? 0 : count;
        } catch (Exception e) {
            return 0;
        }
    }

    /**
     * 校验授权负载字段合法性
     */
    private void validatePayload(LicensePayload payload) {
        if (payload == null) {
            throw new IllegalArgumentException("授权负载为空");
        }
        long codeExpireAtSeconds = resolveCodeExpireAt(payload);
        if (codeExpireAtSeconds <= 0) {
            throw new IllegalArgumentException("授权码有效时间无效");
        }
        LocalDateTime codeExpireAt = LocalDateTime.ofEpochSecond(codeExpireAtSeconds, 0, ZoneOffset.UTC);
        if (codeExpireAt.isBefore(LocalDateTime.now())) {
            throw new IllegalArgumentException("授权码已失效，请重新生成");
        }
        if (payload.getExpireAt() == null || payload.getExpireAt() <= 0) {
            throw new IllegalArgumentException("授权到期时间无效");
        }
        LocalDateTime expireAt = LocalDateTime.ofEpochSecond(payload.getExpireAt(), 0, ZoneOffset.UTC);
        if (expireAt.isBefore(LocalDateTime.now())) {
            throw new IllegalArgumentException("授权码已过期");
        }
        if (payload.getMaxTasks() == null || payload.getMaxTasks() <= 0) {
            throw new IllegalArgumentException("任务上限必须大于0");
        }
        if (payload.getFeatures() == null || payload.getFeatures().isEmpty()) {
            throw new IllegalArgumentException("授权功能列表不能为空");
        }
        List<String> normalized = new ArrayList<>();
        for (String feature : payload.getFeatures()) {
            if (feature != null && !feature.trim().isEmpty()) {
                normalized.add(feature.trim().toUpperCase());
            }
        }
        if (normalized.isEmpty()) {
            throw new IllegalArgumentException("授权功能列表不能为空");
        }
        payload.setFeatures(normalized);
    }

    /**
     * 解析授权码可激活截止时间，兼容旧版未携带 codeExpireAt 的授权码
     */
    private long resolveCodeExpireAt(LicensePayload payload) {
        if (payload.getCodeExpireAt() != null && payload.getCodeExpireAt() > 0) {
            return payload.getCodeExpireAt();
        }
        if (payload.getIssuedAt() != null && payload.getIssuedAt() > 0) {
            // 旧授权码默认仅允许在签发后 24 小时内激活
            return payload.getIssuedAt() + 24L * 60 * 60;
        }
        return -1L;
    }

    /**
     * 判断功能是否命中授权规则，支持 * 通配模式
     */
    private boolean isFeatureAllowed(List<String> grantedFeatures, String requiredFeature) {
        if (requiredFeature == null || requiredFeature.isBlank()) {
            return false;
        }
        String required = requiredFeature.trim().toUpperCase();
        for (String granted : grantedFeatures) {
            if (granted == null || granted.isBlank()) {
                continue;
            }
            String rule = granted.trim().toUpperCase();
            if ("*".equals(rule)) {
                return true;
            }
            if (rule.endsWith("*")) {
                String prefix = rule.substring(0, rule.length() - 1);
                if (!prefix.isEmpty() && required.startsWith(prefix)) {
                    return true;
                }
                continue;
            }
            if (rule.equals(required)) {
                return true;
            }
        }
        return false;
    }

    /**
     * 解析功能列表JSON
     */
    private List<String> parseFeatures(String featuresJson) {
        if (featuresJson == null || featuresJson.isBlank()) {
            return Collections.emptyList();
        }
        try {
            List<String> raw = objectMapper.readValue(featuresJson, new TypeReference<List<String>>() {});
            List<String> normalized = new ArrayList<>();
            for (String item : raw) {
                if (item != null && !item.trim().isEmpty()) {
                    normalized.add(item.trim().toUpperCase());
                }
            }
            return normalized;
        } catch (Exception e) {
            return Collections.emptyList();
        }
    }

    /**
     * 序列化功能列表为JSON
     */
    private String writeFeatures(List<String> features) {
        try {
            List<String> normalized = new ArrayList<>();
            for (String feature : features) {
                if (feature != null && !feature.trim().isEmpty()) {
                    normalized.add(feature.trim().toUpperCase());
                }
            }
            return objectMapper.writeValueAsString(normalized);
        } catch (Exception e) {
            throw new IllegalStateException("功能列表序列化失败", e);
        }
    }
}
