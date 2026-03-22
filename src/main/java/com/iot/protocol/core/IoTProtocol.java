package com.iot.protocol.core;

import com.iot.entity.Device;
import com.iot.entity.OperationType;

import java.util.List;
import java.util.Map;

/**
 * IoT 驱动核心接口
 * 所有自定义驱动必须实现此接口
 * 提供完整的驱动生命周期管理、数据读写、订阅等功能
 */
public interface IoTProtocol {
    
    /**
     * 获取驱动名称
     */
    String getDriverName();
    
    /**
     * 获取驱动版本
     */
    String getDriverVersion();
    
    /**
     * 获取支持的协议类型
     */
    String getProtocolType();
    
    /**
     * 驱动初始化
     * @param config 驱动配置
     */
    void initialize(DriverConfig config) throws DriverException;
    
    /**
     * 连接设备
     * @param device 设备信息
     */
    boolean connect(Device device) throws DriverException;
    
    /**
     * 断开设备连接
     */
    void disconnect(Device device) throws DriverException;
    
    /**
     * 检查设备是否已连接
     */
    boolean isConnected(Device device);
    
    /**
     * 获取驱动状态
     */
    DriverStatus getStatus();
    
    /**
     * 读取单个点位数据
     * @param device 设备信息
     * @param pointInfo 点位信息
     * @return 读取结果
     */
    ReadResult read(Device device, PointInfo pointInfo) throws DriverException;
    
    /**
     * 批量读取点位数据
     * @param device 设备信息
     * @param pointInfos 点位信息列表
     * @return 读取结果列表
     */
    List<ReadResult> batchRead(Device device, List<PointInfo> pointInfos) throws DriverException;
    
    /**
     * 写入单个点位数据
     * @param device 设备信息
     * @param pointInfo 点位信息
     * @param value 写入值
     * @return 写入结果
     */
    WriteResult write(Device device, PointInfo pointInfo, Object value) throws DriverException;
    
    /**
     * 批量写入点位数据
     * @param device 设备信息
     * @param dataMap 点位信息到值的映射
     * @return 写入结果列表
     */
    List<WriteResult> batchWrite(Device device, Map<PointInfo, Object> dataMap) throws DriverException;
    
    /**
     * 订阅数据变化
     * @param device 设备信息
     * @param pointInfos 点位信息列表
     * @param listener 数据变化监听器
     */
    void subscribe(Device device, List<PointInfo> pointInfos, DataChangeListener listener) throws DriverException;
    
    /**
     * 取消订阅
     * @param device 设备信息
     * @param pointInfos 点位信息列表
     */
    void unsubscribe(Device device, List<PointInfo> pointInfos) throws DriverException;
    
    /**
     * 执行设备操作
     * @param device 设备信息
     * @param operationType 操作类型
     * @param params 操作参数
     * @return 操作响应
     */
    ProtocolResponse executeOperation(Device device, OperationType operationType, Map<String, Object> params) throws DriverException;
    
    /**
     * 读取设备数据（兼容原有接口）
     */
    @Deprecated
    default ProtocolResponse readData(Device device, Map<String, Object> params) {
        try {
            PointInfo pointInfo = PointInfo.builder()
                    .pointCode((String) params.get("pointCode"))
                    .build();
            ReadResult result = read(device, pointInfo);
            return ProtocolResponse.ok(result.getValue());
        } catch (DriverException e) {
            return ProtocolResponse.error(e.getMessage());
        }
    }
    
    /**
     * 销毁驱动，释放资源
     */
    void destroy() throws DriverException;
}
