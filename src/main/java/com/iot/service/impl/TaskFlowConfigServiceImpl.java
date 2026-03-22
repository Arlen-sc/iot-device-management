package com.iot.service.impl;

import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.iot.entity.TaskFlowConfig;
import com.iot.mapper.TaskFlowConfigMapper;
import com.iot.service.TaskFlowConfigService;
import org.springframework.stereotype.Service;

@Service
public class TaskFlowConfigServiceImpl extends ServiceImpl<TaskFlowConfigMapper, TaskFlowConfig>
        implements TaskFlowConfigService {

    @Override
    public boolean save(TaskFlowConfig entity) {
        if (entity.getVersion() == null) {
            entity.setVersion(1);
        } else {
            entity.setVersion(entity.getVersion() + 1);
        }
        return super.save(entity);
    }

    @Override
    public boolean updateById(TaskFlowConfig entity) {
        TaskFlowConfig existing = getById(entity.getId());
        if (existing != null) {
            entity.setVersion(existing.getVersion() == null ? 1 : existing.getVersion() + 1);
        }
        return super.updateById(entity);
    }
}
