package com.iot.service.impl;

import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.iot.entity.DeviceCategory;
import com.iot.mapper.DeviceCategoryMapper;
import com.iot.service.DeviceCategoryService;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
public class DeviceCategoryServiceImpl extends ServiceImpl<DeviceCategoryMapper, DeviceCategory>
        implements DeviceCategoryService {

    @Override
    public List<DeviceCategory> getTree() {
        List<DeviceCategory> allCategories = list();
        Map<Long, List<DeviceCategory>> parentIdMap = allCategories.stream()
                .collect(Collectors.groupingBy(
                        c -> c.getParentId() == null ? 0L : c.getParentId()
                ));

        List<DeviceCategory> roots = parentIdMap.getOrDefault(0L, new ArrayList<>());
        roots.forEach(root -> buildChildren(root, parentIdMap));
        return roots;
    }

    private void buildChildren(DeviceCategory parent, Map<Long, List<DeviceCategory>> parentIdMap) {
        List<DeviceCategory> children = parentIdMap.get(parent.getId());
        if (children != null) {
            parent.setChildren(children);
            children.forEach(child -> buildChildren(child, parentIdMap));
        }
    }
}
