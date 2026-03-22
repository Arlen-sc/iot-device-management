package com.iot.util;

import org.jasypt.encryption.StringEncryptor;
import org.jasypt.encryption.pbe.StandardPBEStringEncryptor;
import org.jasypt.encryption.pbe.config.EnvironmentStringPBEConfig;
import org.springframework.stereotype.Component;

/**
 * 加密工具类 - 用于敏感数据加密存储
 */
@Component
public class EncryptionUtil {

    private static final String ENCRYPTION_PASSWORD = "iot-device-management-secret-key-2024";
    private static final String ALGORITHM = "PBEWithMD5AndDES";

    private final StringEncryptor encryptor;

    public EncryptionUtil() {
        StandardPBEStringEncryptor standardEncryptor = new StandardPBEStringEncryptor();
        EnvironmentStringPBEConfig config = new EnvironmentStringPBEConfig();
        config.setAlgorithm(ALGORITHM);
        config.setPassword(ENCRYPTION_PASSWORD);
        standardEncryptor.setConfig(config);
        this.encryptor = standardEncryptor;
    }

    /**
     * 加密字符串
     * @param plainText 明文
     * @return 加密后的字符串
     */
    public String encrypt(String plainText) {
        if (plainText == null || plainText.isEmpty()) {
            return plainText;
        }
        return encryptor.encrypt(plainText);
    }

    /**
     * 解密字符串
     * @param encryptedText 加密后的字符串
     * @return 明文
     */
    public String decrypt(String encryptedText) {
        if (encryptedText == null || encryptedText.isEmpty()) {
            return encryptedText;
        }
        try {
            return encryptor.decrypt(encryptedText);
        } catch (Exception e) {
            return encryptedText;
        }
    }

    /**
     * 判断是否为加密字符串
     * @param text 字符串
     * @return 是否加密
     */
    public boolean isEncrypted(String text) {
        if (text == null || text.isEmpty()) {
            return false;
        }
        try {
            encryptor.decrypt(text);
            return true;
        } catch (Exception e) {
            return false;
        }
    }
}
