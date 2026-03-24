/**
 * 流程节点配置表单。表单项按类型拆至 node-form/fields/ 并由 fieldRegistry 注册。
 * 扩展约定见 docs/node-form-extensibility.md 与 .cursor/rules/node-form.mdc
 */
import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Form, Input, message } from 'antd';
import api from '../utils/api';
import { buildNodeFormInitialValues } from './node-form/normalizeNodeConfig';
import { NODE_FIELD_COMPONENTS } from './node-form/fieldRegistry';
import DefaultNodeFields from './node-form/fields/DefaultNodeFields';

const NodeForm = ({ nodeData, onSave, variableOptions = [] }) => {
  const [form] = Form.useForm();
  const type = nodeData.type;
  const isInitialLoadRef = useRef(true);
  // 中文注释：设计器页未包裹 antd <App>，禁止使用 App.useApp()；使用静态 message API。
  const [deviceOptions, setDeviceOptions] = useState([]);
  const [deviceDataList, setDeviceDataList] = useState([]);
  const [operationTypes, setOperationTypes] = useState([]);
  const [dataSourceOptions, setDataSourceOptions] = useState([]);
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [selectedOpDesc, setSelectedOpDesc] = useState('');

  const handleDeviceChange = useCallback(
    (val) => {
      const dev = deviceDataList.find((d) => String(d.id) === String(val));
      setSelectedDevice(dev || null);
    },
    [deviceDataList]
  );

  const handleOperationChange = useCallback((val) => {
    const op = operationTypes.find((o) => String(o.code || o.id) === String(val));
    setSelectedOpDesc(op?.description || '');
  }, [operationTypes]);

  useEffect(() => {
    const initialValues = buildNodeFormInitialValues(nodeData, type);
    form.setFieldsValue(initialValues);

    // 中文注释：与表单 initialValues 同步设备/操作说明展示；需在 setFieldsValue 之后执行。
    if (type === 'DEVICE_CONTROL' || type === 'DEVICE_DATA') {
      if (initialValues.deviceId) {
        queueMicrotask(() => handleDeviceChange(initialValues.deviceId));
      }
      if (initialValues.operationType) {
        queueMicrotask(() => handleOperationChange(initialValues.operationType));
      }
    }
  }, [nodeData, form, type, deviceDataList, operationTypes, handleDeviceChange, handleOperationChange]);

  useEffect(() => {
    const loadDevices = async () => {
      try {
        const res = await api.get('/devices');
        setDeviceDataList(res || []);
        const list = (res || []).map((item) => ({
          label: `${item.name || '未命名设备'} (ID:${item.id})`,
          value: String(item.id),
        }));
        setDeviceOptions(list);
      } catch {
        setDeviceOptions([]);
        setDeviceDataList([]);
      }
    };

    const loadOperations = async () => {
      try {
        let res;
        try {
          res = await api.get('/operation-types');
        } catch {
          res = [
            { code: 'light_on', name: '开灯', description: '打开设备的主控开关。需要参数：无。' },
            { code: 'light_off', name: '关灯', description: '关闭设备的主控开关。需要参数：无。' },
            { code: 'set_temp', name: '设置温度', description: '调节空调或温控设备的设定温度。需要参数：temperature (整数，单位℃)' },
            { code: 'reboot', name: '重启设备', description: '向设备下发软重启指令，设备将在一分钟内离线并重新上线。' },
            { code: 'read_status', name: '读取状态', description: '主动拉取设备的最新全量运行状态数据。' },
          ];
        }
        setOperationTypes(res || []);
      } catch {
        setOperationTypes([]);
      }
    };

    const loadDataSources = async () => {
      try {
        const res = await api.get('/data-sources');
        const list = (res || []).map((item) => ({
          label: `${item.name || '未命名数据源'} (ID:${item.id})`,
          value: String(item.id),
        }));
        setDataSourceOptions(list);
      } catch {
        setDataSourceOptions([]);
      }
    };

    loadDevices();
    if (type === 'DB_OPERATION') {
      loadDataSources();
    }
    if (type === 'DEVICE_CONTROL') {
      loadOperations();
    }
  }, [type]);

  useEffect(() => {
    const timer = setTimeout(() => {
      isInitialLoadRef.current = false;
    }, 300);
    return () => clearTimeout(timer);
  }, []);

  const handleFinish = (values) => {
    try {
      const safeValues = { ...values };

      if (safeValues.operations && Array.isArray(safeValues.operations)) {
        safeValues.operations = safeValues.operations.map((op) => {
          if (!op || typeof op !== 'object') return op;
          const safeOp = { ...op };
          if (safeOp.paramsStr) {
            try {
              safeOp.params = JSON.parse(safeOp.paramsStr);
            } catch {
              message.error(`附加参数 JSON 解析失败: ${safeOp.paramsStr}`);
            }
            delete safeOp.paramsStr;
          }
          return safeOp;
        });
      }

      if (safeValues.branches && Array.isArray(safeValues.branches)) {
        safeValues.branches = safeValues.branches.map((branch) => {
          if (!branch || typeof branch !== 'object') {
            return branch;
          }
          const safeBranch = { ...branch };
          if (safeBranch.condition && typeof safeBranch.condition === 'object') {
            if (safeBranch.condition.variable !== undefined) {
              safeBranch.condition.left = safeBranch.condition.variable;
            }
            if (safeBranch.condition.value !== undefined) {
              safeBranch.condition.right = safeBranch.condition.value;
            }
            delete safeBranch.condition.variable;
            delete safeBranch.condition.value;
          }
          return safeBranch;
        });
      }

      if (type === 'DEVICE_CONTROL') {
        if (safeValues.paramsList && Array.isArray(safeValues.paramsList)) {
          safeValues.params = safeValues.paramsList;
        }
      }

      if (onSave && typeof onSave === 'function') {
        onSave({
          ...nodeData,
          config: safeValues,
        });
      }
    } catch (err) {
      message.error('保存节点配置失败: ' + (err?.message || String(err)));
    }
  };

  const handleValuesChange = (_changedValues, allValues) => {
    if (isInitialLoadRef.current) {
      return;
    }
    handleFinish(allValues);
  };

  const SpecificFields = NODE_FIELD_COMPONENTS[type] || DefaultNodeFields;

  return (
    <Form form={form} layout="vertical" onValuesChange={handleValuesChange}>
      <Form.Item name="name" label="节点名称" rules={[{ required: true }]}>
        <Input />
      </Form.Item>

      <SpecificFields
        form={form}
        variableOptions={variableOptions}
        deviceOptions={deviceOptions}
        dataSourceOptions={dataSourceOptions}
        operationTypes={operationTypes}
        selectedDevice={selectedDevice}
        selectedOpDesc={selectedOpDesc}
        handleDeviceChange={handleDeviceChange}
        handleOperationChange={handleOperationChange}
      />
    </Form>
  );
};

export default NodeForm;
