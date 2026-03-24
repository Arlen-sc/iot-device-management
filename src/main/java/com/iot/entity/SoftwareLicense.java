package com.iot.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

/**
 * 软件授权实体
 */
@Data
@TableName("software_license")
public class SoftwareLicense {

    @TableId(type = IdType.INPUT)
    private Long id;

    /**
     * 授权码原文
     */
    private String licenseCode;

    /**
     * 绑定的机器码
     */
    private String machineCode;

    /**
     * 授权到期时间
     */
    private LocalDateTime expireAt;

    /**
     * 允许创建的最大任务数
     */
    private Integer maxTasks;

    /**
     * 功能列表（JSON数组字符串）
     */
    private String featuresJson;

    /**
     * 授权状态：0=试用，1=正式授权
     */
    private Integer status;

    /**
     * 激活时间
     */
    private LocalDateTime activatedAt;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;
}
