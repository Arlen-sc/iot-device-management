package com.iot.service.impl;

import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.iot.entity.AlertConfig;
import com.iot.mapper.AlertConfigMapper;
import com.iot.service.AlertService;
import org.springframework.stereotype.Service;

@Service
public class AlertServiceImpl extends ServiceImpl<AlertConfigMapper, AlertConfig>
        implements AlertService {
}
