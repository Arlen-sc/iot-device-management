package com.iot.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.iot.entity.OperationType;
import org.apache.ibatis.annotations.Mapper;

@Mapper
public interface OperationTypeMapper extends BaseMapper<OperationType> {
}
