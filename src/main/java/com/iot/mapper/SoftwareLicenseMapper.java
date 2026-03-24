package com.iot.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.iot.entity.SoftwareLicense;
import org.apache.ibatis.annotations.Mapper;

/**
 * 软件授权 Mapper
 */
@Mapper
public interface SoftwareLicenseMapper extends BaseMapper<SoftwareLicense> {
}
