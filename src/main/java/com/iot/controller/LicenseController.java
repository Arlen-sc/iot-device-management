package com.iot.controller;

import com.iot.service.LicenseService;
import com.iot.util.R;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * 软件授权控制器
 */
@RestController
@RequestMapping("/api/license")
@RequiredArgsConstructor
public class LicenseController {

    private final LicenseService licenseService;

    /**
     * 获取当前授权状态
     */
    @GetMapping("/status")
    public R<Map<String, Object>> status() {
        try {
            return R.ok(licenseService.getLicenseStatus());
        } catch (Exception e) {
            return R.error(e.getMessage());
        }
    }

    /**
     * 激活授权码
     */
    @PostMapping("/activate")
    public R<Map<String, Object>> activate(@RequestBody Map<String, String> req) {
        try {
            String licenseCode = req == null ? null : req.get("licenseCode");
            return R.ok(licenseService.activateLicense(licenseCode));
        } catch (Exception e) {
            return R.error(e.getMessage());
        }
    }
}
