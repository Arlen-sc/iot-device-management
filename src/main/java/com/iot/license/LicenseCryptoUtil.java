package com.iot.license;

import com.fasterxml.jackson.databind.ObjectMapper;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Base64;

/**
 * 授权码加解密与签名工具
 */
public final class LicenseCryptoUtil {

    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();
    private static final String HMAC_SHA256 = "HmacSHA256";

    private LicenseCryptoUtil() {
    }

    /**
     * 验证授权码签名并解析负载
     */
    public static LicensePayload verifyAndParse(String licenseCode, String secret) {
        if (licenseCode == null || !licenseCode.contains(".")) {
            throw new IllegalArgumentException("授权码格式不正确");
        }
        String[] parts = licenseCode.split("\\.", 2);
        if (parts.length != 2) {
            throw new IllegalArgumentException("授权码格式不正确");
        }

        String payloadPart = parts[0];
        String signPart = parts[1];
        byte[] payloadBytes = decodeBase64Url(payloadPart);
        String payloadJson = new String(payloadBytes, StandardCharsets.UTF_8);

        byte[] expectedSign = hmacSha256(payloadJson.getBytes(StandardCharsets.UTF_8), secret);
        byte[] actualSign = decodeBase64Url(signPart);
        if (!MessageDigest.isEqual(expectedSign, actualSign)) {
            throw new IllegalArgumentException("授权码签名校验失败");
        }

        try {
            return OBJECT_MAPPER.readValue(payloadJson, LicensePayload.class);
        } catch (Exception e) {
            throw new IllegalArgumentException("授权码内容无法解析");
        }
    }

    /**
     * 计算机器码（稳定指纹，非绝对防伪）
     */
    public static String buildMachineCode() {
        String osName = value(System.getProperty("os.name"));
        String osArch = value(System.getProperty("os.arch"));
        String userName = value(System.getProperty("user.name"));
        String computerName = value(System.getenv("COMPUTERNAME"));
        String hostName = value(System.getenv("HOSTNAME"));
        String raw = osName + "|" + osArch + "|" + userName + "|" + computerName + "|" + hostName;
        byte[] digest = sha256(raw.getBytes(StandardCharsets.UTF_8));
        return toHex(digest);
    }

    private static String value(String input) {
        return input == null ? "" : input.trim();
    }

    private static byte[] hmacSha256(byte[] data, String secret) {
        try {
            Mac mac = Mac.getInstance(HMAC_SHA256);
            mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), HMAC_SHA256));
            return mac.doFinal(data);
        } catch (Exception e) {
            throw new IllegalStateException("授权签名计算失败", e);
        }
    }

    private static byte[] decodeBase64Url(String value) {
        try {
            return Base64.getUrlDecoder().decode(value);
        } catch (Exception e) {
            throw new IllegalArgumentException("授权码Base64解码失败");
        }
    }

    private static byte[] sha256(byte[] data) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return digest.digest(data);
        } catch (Exception e) {
            throw new IllegalStateException("机器码计算失败", e);
        }
    }

    private static String toHex(byte[] bytes) {
        StringBuilder sb = new StringBuilder(bytes.length * 2);
        for (byte b : bytes) {
            sb.append(Character.forDigit((b >> 4) & 0xF, 16));
            sb.append(Character.forDigit(b & 0xF, 16));
        }
        return sb.toString().toUpperCase();
    }
}
