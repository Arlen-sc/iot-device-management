package com.iot.service.impl;

import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.iot.entity.FlowExecutionLog;
import com.iot.mapper.FlowExecutionLogMapper;
import com.iot.service.FlowExecutionLogService;
import org.springframework.stereotype.Service;

@Service
public class FlowExecutionLogServiceImpl extends ServiceImpl<FlowExecutionLogMapper, FlowExecutionLog>
        implements FlowExecutionLogService {
}
