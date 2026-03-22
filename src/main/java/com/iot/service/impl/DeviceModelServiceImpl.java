package com.iot.service.impl;

import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.iot.entity.DeviceModel;
import com.iot.mapper.DeviceModelMapper;
import com.iot.service.DeviceModelService;
import org.springframework.stereotype.Service;

@Service
public class DeviceModelServiceImpl extends ServiceImpl<DeviceModelMapper, DeviceModel>
        implements DeviceModelService {
}
