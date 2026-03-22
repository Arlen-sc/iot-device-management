package com.iot.service;

import com.baomidou.mybatisplus.extension.service.IService;
import com.iot.entity.DeviceCategory;

import java.util.List;

public interface DeviceCategoryService extends IService<DeviceCategory> {

    List<DeviceCategory> getTree();
}
