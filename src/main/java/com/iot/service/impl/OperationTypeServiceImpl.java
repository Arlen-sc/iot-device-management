package com.iot.service.impl;

import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.iot.entity.OperationType;
import com.iot.mapper.OperationTypeMapper;
import com.iot.service.OperationTypeService;
import org.springframework.stereotype.Service;

@Service
public class OperationTypeServiceImpl extends ServiceImpl<OperationTypeMapper, OperationType>
        implements OperationTypeService {
}
