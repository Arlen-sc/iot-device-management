package com.iot.protocol.core;

/**
 * 驱动异常
 * 用于封装驱动操作过程中的异常
 */
public class DriverException extends Exception {
    
    private static final long serialVersionUID = 1L;
    
    private final String errorCode;
    
    public DriverException(String message) {
        super(message);
        this.errorCode = "UNKNOWN_ERROR";
    }
    
    public DriverException(String message, Throwable cause) {
        super(message, cause);
        this.errorCode = "UNKNOWN_ERROR";
    }
    
    public DriverException(String errorCode, String message) {
        super(message);
        this.errorCode = errorCode;
    }
    
    public DriverException(String errorCode, String message, Throwable cause) {
        super(message, cause);
        this.errorCode = errorCode;
    }
    
    public String getErrorCode() {
        return errorCode;
    }
}
