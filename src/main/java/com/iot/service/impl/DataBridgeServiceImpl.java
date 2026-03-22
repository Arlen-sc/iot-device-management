package com.iot.service.impl;

import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.iot.entity.DataBridge;
import com.iot.mapper.DataBridgeMapper;
import com.iot.service.DataBridgeService;
import org.springframework.stereotype.Service;

@Service
public class DataBridgeServiceImpl extends ServiceImpl<DataBridgeMapper, DataBridge>
        implements DataBridgeService {
}
