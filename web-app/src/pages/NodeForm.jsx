import React, { useEffect, useState, useRef } from 'react';
import { Form, Input, InputNumber, Select, Button, Space, Switch, App } from 'antd';
import { MinusCircleOutlined, PlusOutlined } from '@ant-design/icons';
import api from '../utils/api';

const { TextArea } = Input;
const { Option } = Select;

const SCRIPT_OPERATION_OPTIONS = [
  { value: 'HEX_STRING_TO_DEC_ARRAY', label: 'HEX_STRING_TO_DEC_ARRAY（Hex串->十进制数组）' },
  { value: 'SPLIT', label: 'SPLIT（字符串拆分）' },
  { value: 'JOIN', label: 'JOIN（数组拼接）' },
  { value: 'HEX_ARRAY_TO_DEC', label: 'HEX_ARRAY_TO_DEC（Hex数组->十进制）' },
  { value: 'DEC_ARRAY_TO_HEX', label: 'DEC_ARRAY_TO_HEX（十进制数组->Hex）' },
  { value: 'HEX_TO_DEC', label: 'HEX_TO_DEC（单个Hex->十进制）' },
  { value: 'DEC_TO_HEX', label: 'DEC_TO_HEX（单个十进制->Hex）' },
  { value: 'ARRAY_LENGTH', label: 'ARRAY_LENGTH（长度）' },
  { value: 'ARRAY_SLICE', label: 'ARRAY_SLICE（切片）' },
  { value: 'STRING_TO_HEX', label: 'STRING_TO_HEX（字符串->Hex）' },
  { value: 'HEX_TO_STRING', label: 'HEX_TO_STRING（Hex->字符串）' },
  { value: 'STRIP_PREFIX', label: 'STRIP_PREFIX（去前缀）' },
  { value: 'CONCAT', label: 'CONCAT（拼接）' },
  { value: 'TEMPLATE', label: 'TEMPLATE（模板替换）' },
  { value: 'FORMAT_VALUES', label: 'FORMAT_VALUES（格式化键值串）' },
  { value: 'PARSE_CSV_VALUES', label: 'PARSE_CSV_VALUES（k=v解析）' },
  { value: 'JSON_BUILD', label: 'JSON_BUILD（构建JSON）' },
  { value: 'JSON_PARSE', label: 'JSON_PARSE（解析JSON）' },
  { value: 'JSON_STRINGIFY', label: 'JSON_STRINGIFY（对象转JSON字符串）' },
  { value: 'ROUND', label: 'ROUND（四舍五入）' },
  { value: 'TO_NUMBER', label: 'TO_NUMBER（转数字）' },
  { value: 'TO_STRING', label: 'TO_STRING（转字符串）' },
  { value: 'SUBSTRING', label: 'SUBSTRING（截取子串）' },
  { value: 'REPLACE', label: 'REPLACE（字符串替换）' }
];

const CONDITION_OPERATOR_OPTIONS = [
  { value: '>', label: '大于 (>)' },
  { value: '>=', label: '大于等于 (>=)' },
  { value: '<', label: '小于 (<)' },
  { value: '<=', label: '小于等于 (<=)' },
  { value: '==', label: '等于 (==)' },
  { value: '!=', label: '不等于 (!=)' },
  { value: 'contains', label: '包含' },
  { value: 'starts_with', label: '匹配前缀' },
  { value: 'ends_with', label: '匹配后缀' },
  { value: 'is_empty', label: '变量为空' },
  { value: 'not_empty', label: '变量不为空' },
  { value: 'array_length_eq', label: '数组长度 = 指定值' },
  { value: 'array_length_gt', label: '数组长度 > 指定值' },
  { value: 'array_length_gte', label: '数组长度 >= 指定值' },
  { value: 'array_length_lt', label: '数组长度 < 指定值' },
  { value: 'array_length_lte', label: '数组长度 <= 指定值' }
];

const CONDITION_ARRAY_LENGTH_OPS = [
  'array_length_eq',
  'array_length_gt',
  'array_length_gte',
  'array_length_lt',
  'array_length_lte'
];

const CONDITION_UNARY_OPS = ['is_empty', 'not_empty', 'is_null', 'not_null'];

// A simplified generic Node Form to replace the huge vanilla JS one
const NodeForm = ({ nodeData, onSave }) => {
  const [form] = Form.useForm();
  const type = nodeData.type;
  const saveTimeoutRef = useRef(null);
  const isInitialLoadRef = useRef(true);
  const { message } = App.useApp();
  const [deviceOptions, setDeviceOptions] = useState([]);
  const [deviceDataList, setDeviceDataList] = useState([]);
  const [operationTypes, setOperationTypes] = useState([]);
  const [dataSourceOptions, setDataSourceOptions] = useState([]);
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [selectedOpDesc, setSelectedOpDesc] = useState('');

  // 监听选中设备的变化，以便展示设备信息
  const handleDeviceChange = (val) => {
    const dev = deviceDataList.find(d => String(d.id) === String(val));
    setSelectedDevice(dev || null);
  };

  // 监听操作类型的变化，以便展示操作说明
  const handleOperationChange = (val) => {
    const op = operationTypes.find(o => String(o.code || o.id) === String(val));
    setSelectedOpDesc(op?.description || '');
  };

  // 需要动态监控表单字段以控制条件渲染
  const dataOperation = Form.useWatch('operation', form);
  const dbSqlValue = Form.useWatch('sql', form);

  useEffect(() => {
    let initialValues = { ...nodeData.config } || { name: type };
    
    // 反向解析特殊格式以适应表单
    if (Array.isArray(initialValues.operations)) {
      initialValues.operations = initialValues.operations.map(op => {
        if (!op || typeof op !== 'object') {
          return op;
        }
        return {
          ...op,
          paramsStr: op.params ? JSON.stringify(op.params) : undefined
        };
      });
    }

    if (Array.isArray(initialValues.branches)) {
      initialValues.branches = initialValues.branches.map(branch => {
        if (!branch || typeof branch !== 'object') {
          return branch;
        }
        const cond = branch.condition;
        if (cond && typeof cond === 'object' && cond.left !== undefined) {
          return {
            ...branch,
            condition: {
              ...cond,
              variable: cond.left,
              value: cond.right
            }
          };
        }
        return branch;
      });
    }

    if (initialValues.params && Array.isArray(initialValues.params)) {
      initialValues.paramsList = initialValues.params;
    }

    form.setFieldsValue(initialValues);

    // Initial triggers for side effects
    if (type === 'DEVICE_CONTROL' || type === 'DEVICE_DATA') {
      if (initialValues.deviceId) handleDeviceChange(initialValues.deviceId);
      if (initialValues.operationType) handleOperationChange(initialValues.operationType);
    }
  }, [nodeData, form, type, deviceDataList, operationTypes]);

  useEffect(() => {
    const loadDevices = async () => {
      try {
        const res = await api.get('/devices');
        setDeviceDataList(res || []);
        const list = (res || []).map(item => ({
          label: `${item.name || '未命名设备'} (ID:${item.id})`,
          value: String(item.id)
        }));
        setDeviceOptions(list);
      } catch (e) {
        setDeviceOptions([]);
        setDeviceDataList([]);
      }
    };
    
    const loadOperations = async () => {
      try {
        // Fallback for demo if API doesn't exist yet
        let res;
        try {
          res = await api.get('/operation-types');
        } catch (_) {
          res = [
            { code: 'light_on', name: '开灯', description: '打开设备的主控开关。需要参数：无。' },
            { code: 'light_off', name: '关灯', description: '关闭设备的主控开关。需要参数：无。' },
            { code: 'set_temp', name: '设置温度', description: '调节空调或温控设备的设定温度。需要参数：temperature (整数，单位℃)' },
            { code: 'reboot', name: '重启设备', description: '向设备下发软重启指令，设备将在一分钟内离线并重新上线。' },
            { code: 'read_status', name: '读取状态', description: '主动拉取设备的最新全量运行状态数据。' }
          ];
        }
        setOperationTypes(res || []);
      } catch (e) {
        setOperationTypes([]);
      }
    };

    const loadDataSources = async () => {
      try {
        const res = await api.get('/data-sources');
        const list = (res || []).map(item => ({
          label: `${item.name || '未命名数据源'} (ID:${item.id})`,
          value: String(item.id)
        }));
        setDataSourceOptions(list);
      } catch (e) {
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

  // 监听表单值变化，自动保存
  useEffect(() => {
    // 不需要额外监听，Form组件的onValuesChange会处理
  }, [form, onSave, type]);

  // 初始加载完成标记
  useEffect(() => {
    const timer = setTimeout(() => {
      isInitialLoadRef.current = false;
    }, 300);
    return () => clearTimeout(timer);
  }, []);

  const handleFinish = (values) => {
    try {
      console.log('NodeForm handleFinish 被调用, type:', type, 'values:', values);
      // 创建一个安全的副本，避免修改原始数据
      const safeValues = { ...values };
      
      // 预处理一些特殊的嵌套数据格式
      if (safeValues.operations && Array.isArray(safeValues.operations)) {
        safeValues.operations = safeValues.operations.map(op => {
          if (!op || typeof op !== 'object') return op;
          const safeOp = { ...op };
          if (safeOp.paramsStr) {
            try {
              safeOp.params = JSON.parse(safeOp.paramsStr);
            } catch (e) {
              message.error(`附加参数 JSON 解析失败: ${safeOp.paramsStr}`);
            }
            delete safeOp.paramsStr;
          }
          return safeOp;
        });
      }

      if (safeValues.branches && Array.isArray(safeValues.branches)) {
        safeValues.branches = safeValues.branches.map(branch => {
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

      // 确保onSave存在
      if (onSave && typeof onSave === 'function') {
        console.log('调用 onSave, data:', { ...nodeData, config: safeValues });
        onSave({
          ...nodeData,
          config: safeValues
        });
      }
    } catch (err) {
      message.error('保存节点配置失败:', err.message);
    }
  };

  // 处理表单值变化
  const handleValuesChange = (changedValues, allValues) => {
    if (isInitialLoadRef.current) {
      return; // 跳过初始加载
    }
    console.log('表单值变化:', allValues);
    handleFinish(allValues);
  };

  const renderSpecificFields = () => {
    switch (type) {
      case 'SCRIPT':
        return (
          <>
            <div style={{ marginBottom: 8, fontSize: 14, fontWeight: 500 }}>
              脚本处理操作 (Operations)
            </div>
            <Form.List name="operations">
              {(fields, { add, remove }) => (
                <>
                  {fields.map(({ key, name, ...restField }) => (
                    <div key={key} style={{ border: '1px dashed #d9d9d9', padding: 12, marginBottom: 12, borderRadius: 4 }}>
                      <Form.Item {...restField} name={[name, 'op']} label="操作类型" initialValue="HEX_STRING_TO_DEC_ARRAY">
                        <Select
                          showSearch
                          optionFilterProp="label"
                          options={SCRIPT_OPERATION_OPTIONS}
                          placeholder="请选择操作类型"
                        >
                        </Select>
                      </Form.Item>
                      <Form.Item {...restField} name={[name, 'source']} label="源变量">
                        <Input placeholder="输入源变量名称" />
                      </Form.Item>
                      <Form.Item {...restField} name={[name, 'target']} label="目标变量">
                        <Input placeholder="输入目标变量名称" />
                      </Form.Item>
                      <Form.Item {...restField} name={[name, 'paramsStr']} label="附加参数 (JSON)">
                        <Input placeholder='如: {"prefix": "v", "delimiter": ","}' />
                      </Form.Item>
                      <MinusCircleOutlined onClick={() => remove(name)} style={{ color: 'red' }} />
                    </div>
                  ))}
                  <Form.Item>
                    <Button type="dashed" onClick={() => add()} block icon={<PlusOutlined />}>
                      添加操作
                    </Button>
                  </Form.Item>
                </>
              )}
            </Form.List>
          </>
        );

      case 'BASE_CONVERT':
        return (
          <>
            <div style={{ marginBottom: 8, fontSize: 14, fontWeight: 500 }}>
              进制转换配置
            </div>
            <Form.Item
              name="mode"
              label="转换模式"
              initialValue="HEX_TO_DEC"
              rules={[{ required: true, message: '请选择转换模式' }]}
            >
              <Select>
                <Option value="HEX_TO_DEC">16进制 → 10进制</Option>
                <Option value="DEC_TO_HEX">10进制 → 16进制</Option>
                <Option value="BIN_TO_DEC">2进制 → 10进制</Option>
                <Option value="DEC_TO_BIN">10进制 → 2进制</Option>
                <Option value="HEX_TO_BIN">16进制 → 2进制</Option>
                <Option value="BIN_TO_HEX">2进制 → 16进制</Option>
                <Option value="CUSTOM">自定义进制 (from/to)</Option>
              </Select>
            </Form.Item>
            <Form.Item name="source" label="源变量" rules={[{ required: true, message: '请输入源变量' }]}>
              <Input placeholder="如: payload.hexValue" />
            </Form.Item>
            <Form.Item name="target" label="目标变量" rules={[{ required: true, message: '请输入目标变量' }]}>
              <Input placeholder="如: payload.decValue" />
            </Form.Item>
            <Form.Item noStyle shouldUpdate={(prev, cur) => prev.mode !== cur.mode}>
              {() => {
                const mode = form.getFieldValue('mode') || 'HEX_TO_DEC';
                if (mode !== 'CUSTOM') {
                  return null;
                }
                return (
                  <>
                    <Form.Item
                      name="fromBase"
                      label="源进制"
                      initialValue={16}
                      rules={[{ required: true, message: '请输入源进制' }]}
                    >
                      <InputNumber min={2} max={36} style={{ width: '100%' }} />
                    </Form.Item>
                    <Form.Item
                      name="toBase"
                      label="目标进制"
                      initialValue={10}
                      rules={[{ required: true, message: '请输入目标进制' }]}
                    >
                      <InputNumber min={2} max={36} style={{ width: '100%' }} />
                    </Form.Item>
                  </>
                );
              }}
            </Form.Item>
            <Form.Item name="uppercase" label="输出字母大写" valuePropName="checked" initialValue={true}>
              <Switch />
            </Form.Item>
            <Form.Item name="withPrefix" label="附加进制前缀(0x/0b)" valuePropName="checked" initialValue={false}>
              <Switch />
            </Form.Item>
          </>
        );

      case 'TCP_SEND':
      case 'TCP_CLIENT':
        return (
          <>
            <Form.Item name="host" label="对端地址" rules={[{ required: true }]}>
              <Input placeholder="127.0.0.1" />
            </Form.Item>
            <Form.Item name="port" label="对端端口" rules={[{ required: true }]}>
              <InputNumber min={1} max={65535} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="readMode" label="读取模式" initialValue="RAW">
              <Select>
                <Option value="RAW">RAW (十六进制流)</Option>
                <Option value="LINE">LINE (按行)</Option>
              </Select>
            </Form.Item>
            <Form.Item name="sendData" label="发送数据">
              <Input placeholder="输入发送内容，支持 ${var}，可留空仅连接" />
            </Form.Item>
            <Form.Item name="sendHex" label="作为十六进制发送" valuePropName="checked">
              <Switch />
            </Form.Item>
            <Form.Item name="waitResponse" label="等待响应" valuePropName="checked" initialValue={false}>
              <Switch />
            </Form.Item>
            <Form.Item name="outputVariable" label="输出变量名">
              <Input placeholder="接收数据写入的变量名" />
            </Form.Item>
            <Form.Item noStyle shouldUpdate={(prev, cur) => prev.waitResponse !== cur.waitResponse}>
              {() => {
                const waitResponse = !!form.getFieldValue('waitResponse');
                if (!waitResponse) {
                  return null;
                }
                return (
                  <div style={{ color: '#888', fontSize: 12, marginBottom: 8 }}>
                    当前为阻塞等待模式：发送后会持续等待服务端返回，不使用超时。
                  </div>
                );
              }}
            </Form.Item>
          </>
        );

      case 'TCP_SERVER':
        return (
          <>
            <Form.Item name="operation" label="服务端操作" initialValue="START" rules={[{ required: true }]}>
              <Select>
                <Option value="START">启动监听</Option>
                <Option value="BROADCAST">广播数据</Option>
                <Option value="RECEIVE">接收数据</Option>
                <Option value="STOP">停止监听</Option>
              </Select>
            </Form.Item>
            <Form.Item name="port" label="监听端口" rules={[{ required: true }]}>
              <InputNumber min={1} max={65535} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item noStyle shouldUpdate={(prev, cur) => prev.operation !== cur.operation}>
              {() => {
                const op = form.getFieldValue('operation') || 'START';
                if (op === 'BROADCAST') {
                  return (
                    <>
                      <Form.Item name="sendData" label="广播内容">
                        <Input placeholder="支持 ${变量}" />
                      </Form.Item>
                      <Form.Item name="sendHex" label="按十六进制解析" valuePropName="checked">
                        <Switch />
                      </Form.Item>
                    </>
                  );
                }
                if (op === 'RECEIVE') {
                  return (
                    <>
                      <Form.Item name="outputVariable" label="输出变量名" initialValue="tcpServerData" rules={[{ required: true }]}>
                        <Input placeholder="接收数据写入变量" />
                      </Form.Item>
                      <div style={{ color: '#888', fontSize: 12, marginBottom: 8 }}>
                        服务端接收为阻塞等待模式：会持续等待客户端数据，不使用超时。
                      </div>
                    </>
                  );
                }
                if (op === 'STOP') {
                  return (
                    <Form.Item name="cleanupOnStop" label="停止时清理本任务队列" valuePropName="checked" initialValue={true}>
                      <Switch />
                    </Form.Item>
                  );
                }
                return (
                  <div style={{ color: '#888', fontSize: 12, marginBottom: 8 }}>
                    同一端口在进程内只会监听一次；连续执行任务不会在 STOP 时关闭端口（见引擎逻辑）。
                  </div>
                );
              }}
            </Form.Item>
          </>
        );

      case 'TCP_LISTEN':
        return (
          <>
            <Form.Item name="host" label="对端地址" rules={[{ required: true }]}>
              <Input placeholder="127.0.0.1" />
            </Form.Item>
            <Form.Item name="port" label="对端端口" rules={[{ required: true }]}>
              <InputNumber min={1} max={65535} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="timeout" label="读取超时 (ms)" initialValue={5000}>
              <InputNumber min={100} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="outputVariable" label="输出变量名" rules={[{ required: true }]} initialValue="tcpData">
              <Input placeholder="接收到的数据存入此变量" />
            </Form.Item>
          </>
        );
      
      case 'DELAY':
        return (
          <Form.Item name="delayMs" label="延迟时间 (毫秒)" rules={[{ required: true }]}>
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
        );

      case 'LOG':
        return (
          <>
            <Form.Item name="level" label="日志级别" initialValue="INFO">
              <Select>
                <Option value="INFO">INFO</Option>
                <Option value="WARN">WARN</Option>
                <Option value="ERROR">ERROR</Option>
              </Select>
            </Form.Item>
            <Form.Item name="message" label="日志消息">
              <Input placeholder="支持 ${变量名} 占位符" />
            </Form.Item>
            <Form.Item name="dataExpression" label="附加数据表达式">
              <Input placeholder="例如: payload.temperature" />
            </Form.Item>
          </>
        );

      case 'HTTP_REQUEST':
        return (
          <>
            <Form.Item name="method" label="请求方法" initialValue="GET">
              <Select>
                <Option value="GET">GET</Option>
                <Option value="POST">POST</Option>
                <Option value="PUT">PUT</Option>
                <Option value="DELETE">DELETE</Option>
              </Select>
            </Form.Item>
            <Form.Item name="url" label="请求地址 (URL)" rules={[{ required: true }]}>
              <Input placeholder="http://api.example.com/data" />
            </Form.Item>
            <Form.Item name="timeout" label="超时时间 (ms)" initialValue={5000}>
              <InputNumber min={100} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="body" label="请求体 (JSON)">
              <TextArea rows={4} placeholder='{"key": "value"}' />
            </Form.Item>
          </>
        );

      case 'CONDITION':
        return (
          <>
            <Form.Item name="logic" label="条件组合逻辑" initialValue="AND">
              <Select>
                <Option value="AND">满足所有条件 (AND)</Option>
                <Option value="OR">满足任一条件 (OR)</Option>
              </Select>
            </Form.Item>
            
            <Form.List name="branches">
              {(fields, { add, remove }) => (
                <>
                  {fields.map(({ key, name, ...restField }) => (
                    <div key={key} style={{ border: '1px dashed #d9d9d9', padding: 12, marginBottom: 12, borderRadius: 4 }}>
                      <Form.Item noStyle shouldUpdate={(prev, cur) => {
                        const prevOp = prev?.branches?.[name]?.condition?.operator;
                        const curOp = cur?.branches?.[name]?.condition?.operator;
                        return prevOp !== curOp;
                      }}>
                        {() => {
                          const op = form.getFieldValue(['branches', name, 'condition', 'operator']);
                          const isArrayLengthMode = CONDITION_ARRAY_LENGTH_OPS.includes(op);
                          return (
                            <Form.Item
                              {...restField}
                              name={[name, 'condition', 'variable']}
                              label="判断变量"
                              help={isArrayLengthMode ? '当前为数组长度判断：请填写数组变量路径（如 payload.items）' : undefined}
                            >
                              <Input placeholder={isArrayLengthMode ? '如: payload.items' : '如: payload.temperature'} />
                            </Form.Item>
                          );
                        }}
                      </Form.Item>
                      <Space align="baseline">
                        <Form.Item {...restField} name={[name, 'condition', 'operator']} initialValue=">">
                          <Select style={{ width: 180 }} options={CONDITION_OPERATOR_OPTIONS} />
                        </Form.Item>
                        <Form.Item noStyle shouldUpdate={(prev, cur) => {
                          const prevOp = prev?.branches?.[name]?.condition?.operator;
                          const curOp = cur?.branches?.[name]?.condition?.operator;
                          return prevOp !== curOp;
                        }}>
                          {() => {
                            const op = form.getFieldValue(['branches', name, 'condition', 'operator']);
                            if (CONDITION_UNARY_OPS.includes(op)) {
                              return null;
                            }
                            if (CONDITION_ARRAY_LENGTH_OPS.includes(op)) {
                              return (
                                <Form.Item {...restField} name={[name, 'condition', 'value']}>
                                  <InputNumber min={0} placeholder="数组长度值" style={{ width: 140 }} />
                                </Form.Item>
                              );
                            }
                            return (
                              <Form.Item {...restField} name={[name, 'condition', 'value']}>
                                <Input placeholder="对比值" />
                              </Form.Item>
                            );
                          }}
                        </Form.Item>
                        <MinusCircleOutlined onClick={() => remove(name)} style={{ color: 'red' }} />
                      </Space>
                    </div>
                  ))}
                  <Form.Item>
                    <Button
                      type="dashed"
                      onClick={() => add({ condition: { operator: '>' } })}
                      block
                      icon={<PlusOutlined />}
                    >
                      添加分支
                    </Button>
                  </Form.Item>
                </>
              )}
            </Form.List>
          </>
        );

      case 'DB_OPERATION':
        return (
          <>
            <Form.Item name="operation" label="操作类型" initialValue="SELECT">
              <Select>
                <Option value="SELECT">查询 (SELECT)</Option>
                <Option value="INSERT">插入 (INSERT)</Option>
                <Option value="UPDATE">更新 (UPDATE)</Option>
                <Option value="DELETE">删除 (DELETE)</Option>
              </Select>
            </Form.Item>
            <Form.Item name="dbMode" label="数据源模式" initialValue="LOCAL">
              <Select>
                <Option value="LOCAL">本地库 (LOCAL)</Option>
                <Option value="REMOTE">外部数据源 (REMOTE)</Option>
              </Select>
            </Form.Item>
            <Form.Item noStyle shouldUpdate={(prev, cur) => prev.dbMode !== cur.dbMode}>
              {() => {
                const mode = form.getFieldValue('dbMode') || 'LOCAL';
                if (mode !== 'REMOTE') return null;
                return (
                  <Form.Item name="dataSourceId" label="选择数据源" rules={[{ required: true, message: '请选择数据源' }]}>
                    <Select
                      showSearch
                      allowClear
                      placeholder="请选择已配置的数据源"
                      options={dataSourceOptions}
                      optionFilterProp="label"
                    />
                  </Form.Item>
                );
              }}
            </Form.Item>
            <Form.Item name="sql" label="自定义 SQL (可选)">
              <TextArea rows={3} placeholder="如输入此项，将优先执行自定义 SQL。支持 ${var} 占位符" />
            </Form.Item>
            {!String(dbSqlValue || '').trim() && (
              <Form.Item name="tableName" label="表名" rules={[{ required: false }]}>
                <Input placeholder="输入数据库表名" />
              </Form.Item>
            )}
            <Form.Item name="outputVariable" label="输出变量名 (仅查询)">
              <Input placeholder="查询结果存入此变量" />
            </Form.Item>
          </>
        );

      case 'DATA_CLEANING':
        return (
          <>
            <Form.Item name="enableNullCheck" label="启用空值检查" valuePropName="checked" initialValue={true}>
              <Switch />
            </Form.Item>
            <Form.Item name="enableRangeCheck" label="启用范围检查" valuePropName="checked" initialValue={true}>
              <Switch />
            </Form.Item>
            <Form.Item name="enableZScore" label="启用 Z-Score 异常检测" valuePropName="checked" initialValue={false}>
              <Switch />
            </Form.Item>
            <Form.Item name="zScoreThreshold" label="Z-Score 阈值" initialValue={3.0}>
              <InputNumber min={0.1} step={0.1} style={{ width: '100%' }} />
            </Form.Item>
          </>
        );
        
      case 'DEVICE_DATA':
        return (
          <>
            <Form.Item name="deviceId" label="目标设备" rules={[{ required: true }]}>
              <Select
                placeholder="请选择要操作的设备"
                showSearch
                allowClear
                options={deviceOptions}
                optionFilterProp="label"
                onChange={handleDeviceChange}
              />
            </Form.Item>

            {/* 动态设备信息展示面板 */}
            {selectedDevice && (
              <div style={{ background: '#f5f5f5', padding: '12px', borderRadius: '6px', marginBottom: '24px', fontSize: '13px' }}>
                <div style={{ marginBottom: '4px' }}>
                  <span style={{ color: '#888', marginRight: '8px' }}>设备名称:</span>
                  <strong>{selectedDevice.name}</strong>
                </div>
                <div style={{ marginBottom: '4px' }}>
                  <span style={{ color: '#888', marginRight: '8px' }}>通信协议:</span>
                  <span style={{ color: '#1890ff' }}>{selectedDevice.protocolType || '未知'}</span>
                </div>
                <div>
                  <span style={{ color: '#888', marginRight: '8px' }}>当前状态:</span>
                  <span style={{ color: selectedDevice.status === 'ONLINE' ? '#52c41a' : '#ff4d4f' }}>
                    {selectedDevice.status === 'ONLINE' ? '🟢 在线' : '🔴 离线'}
                  </span>
                </div>
              </div>
            )}

            <Form.Item name="operation" label="数据操作" initialValue="READ">
              <Select>
                <Option value="READ">读取属性 (READ)</Option>
                <Option value="WRITE">设置属性 (WRITE)</Option>
              </Select>
            </Form.Item>

            <Form.Item name="pointCode" label="属性编码 (Property Key)" rules={[{ required: true }]}>
              <Input placeholder="例如: temperature, humidity, switch_status" />
            </Form.Item>

            {dataOperation === 'WRITE' && (
              <Form.Item name="writeValue" label="要写入的值">
                <Input placeholder="支持固定值或 ${变量名}" />
              </Form.Item>
            )}

            {dataOperation !== 'WRITE' && (
              <Form.Item name="outputVariable" label="输出变量名">
                <Input placeholder="读取结果将存入此变量，如: deviceTemp" />
              </Form.Item>
            )}
          </>
        );

      case 'DEVICE_CONTROL':
        return (
          <>
            <Form.Item name="deviceId" label="目标设备" rules={[{ required: true }]}>
              <Select
                placeholder="必须指定要控制的具体设备"
                showSearch
                allowClear
                options={deviceOptions}
                optionFilterProp="label"
                onChange={handleDeviceChange}
              />
            </Form.Item>

            {/* 动态设备信息展示面板 */}
            {selectedDevice && (
              <div style={{ background: '#f5f5f5', padding: '12px', borderRadius: '6px', marginBottom: '24px', fontSize: '13px' }}>
                <div style={{ marginBottom: '4px' }}>
                  <span style={{ color: '#888', marginRight: '8px' }}>设备名称:</span>
                  <strong>{selectedDevice.name}</strong>
                </div>
                <div style={{ marginBottom: '4px' }}>
                  <span style={{ color: '#888', marginRight: '8px' }}>通信协议:</span>
                  <span style={{ color: '#1890ff' }}>{selectedDevice.protocolType || '未知'}</span>
                </div>
                <div>
                  <span style={{ color: '#888', marginRight: '8px' }}>当前状态:</span>
                  <span style={{ color: selectedDevice.status === 'ONLINE' ? '#52c41a' : '#ff4d4f' }}>
                    {selectedDevice.status === 'ONLINE' ? '🟢 在线' : '🔴 离线'}
                  </span>
                </div>
              </div>
            )}

            <Form.Item name="operationType" label="操作类型" rules={[{ required: true }]}>
              <Select 
                placeholder="请选择要执行的控制指令" 
                onChange={handleOperationChange}
              >
                {operationTypes.map(op => (
                  <Option key={op.code} value={op.code}>
                    {op.name} ({op.code})
                  </Option>
                ))}
              </Select>
            </Form.Item>

            {/* 动态操作说明展示 */}
            {selectedOpDesc && (
              <div style={{ color: '#fa8c16', fontSize: '12px', marginBottom: '24px', marginTop: '-12px', lineHeight: '1.5' }}>
                💡 <strong>指令说明:</strong> {selectedOpDesc}
              </div>
            )}

            <div style={{ marginBottom: '8px', fontSize: '14px', fontWeight: 500 }}>指令参数设置</div>
            <div style={{ color: '#888', fontSize: '12px', marginBottom: '16px', lineHeight: '1.4' }}>
              根据上方选择的【操作类型】，在此处配置需要下发给设备的具体参数键值对。
              <br/>例如控制空调时：参数名(键)填 <code>temperature</code>，参数值填 <code>26</code>。
            </div>

            <Form.List name="paramsList">
              {(fields, { add, remove }) => (
                <>
                  {fields.map(({ key, name, ...restField }) => (
                    <Space key={key} style={{ display: 'flex', marginBottom: 8 }} align="baseline">
                      <Form.Item
                        {...restField}
                        name={[name, 'key']}
                        rules={[{ required: true, message: '请输入参数名' }]}
                      >
                        <Input placeholder="参数名 (如: color)" />
                      </Form.Item>
                      <Form.Item
                        {...restField}
                        name={[name, 'value']}
                        rules={[{ required: true, message: '请输入参数值' }]}
                      >
                        <Input placeholder="参数值 (支持 ${var})" />
                      </Form.Item>
                      <MinusCircleOutlined onClick={() => remove(name)} style={{ color: '#ff4d4f' }} />
                    </Space>
                  ))}
                  <Form.Item>
                    <Button type="dashed" onClick={() => add()} block icon={<PlusOutlined />}>
                      添加参数
                    </Button>
                  </Form.Item>
                </>
              )}
            </Form.List>

            <Form.Item name="timeout" label="超时时间 (ms)" initialValue={5000}>
              <InputNumber min={100} style={{ width: '100%' }} />
            </Form.Item>
          </>
        );

      case 'DEDUP_FILTER':
        return (
          <>
            <Form.Item name="filterType" label="过滤类型" initialValue="VALUE_CHANGED">
              <Select>
                <Option value="VALUE_CHANGED">数值变化 (VALUE_CHANGED)</Option>
                <Option value="TIME_WINDOW">时间窗口 (TIME_WINDOW)</Option>
              </Select>
            </Form.Item>
            <Form.Item name="cacheKey" label="缓存键 (唯一标识)" rules={[{ required: true }]}>
              <Input placeholder="如: device_${deviceId}_status" />
            </Form.Item>
            <Form.Item name="compareValue" label="对比值变量名 (仅数值变化)">
              <Input placeholder="如: payload.status" />
            </Form.Item>
            <Form.Item name="timeWindowMs" label="时间窗口 (ms)" initialValue={60000}>
              <InputNumber min={1000} style={{ width: '100%' }} help="在该时间窗口内相同数据将被过滤" />
            </Form.Item>
          </>
        );

      case 'PLC_READ':
        return (
          <>
            <Form.Item name="ip" label="PLC IP地址" rules={[{ required: true }]}>
              <Input placeholder="192.168.1.100" />
            </Form.Item>
            <Form.Item name="port" label="端口" initialValue={102}>
              <InputNumber min={1} max={65535} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="rack" label="机架号 (Rack)" initialValue={0}>
              <InputNumber min={0} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="slot" label="插槽号 (Slot)" initialValue={1}>
              <InputNumber min={0} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="address" label="读取地址" rules={[{ required: true }]}>
              <Input placeholder="如: DB1.DBW0" />
            </Form.Item>
            <Form.Item name="dataType" label="数据类型" initialValue="INT">
              <Select>
                <Option value="BOOL">BOOL</Option>
                <Option value="INT">INT</Option>
                <Option value="DINT">DINT</Option>
                <Option value="REAL">REAL</Option>
              </Select>
            </Form.Item>
            <Form.Item name="outputVariable" label="输出变量名">
              <Input placeholder="读取结果存入此变量" />
            </Form.Item>
          </>
        );

      case 'PLC_WRITE':
        return (
          <>
            <Form.Item name="ip" label="PLC IP地址" rules={[{ required: true }]}>
              <Input placeholder="192.168.1.100" />
            </Form.Item>
            <Form.Item name="port" label="端口" initialValue={102}>
              <InputNumber min={1} max={65535} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="address" label="写入地址" rules={[{ required: true }]}>
              <Input placeholder="如: DB1.DBW0" />
            </Form.Item>
            <Form.Item name="dataType" label="数据类型" initialValue="INT">
              <Select>
                <Option value="BOOL">BOOL</Option>
                <Option value="INT">INT</Option>
                <Option value="DINT">DINT</Option>
                <Option value="REAL">REAL</Option>
              </Select>
            </Form.Item>
            <Form.Item name="writeValue" label="写入值" rules={[{ required: true }]}>
              <Input placeholder="支持固定值或 ${var}" />
            </Form.Item>
          </>
        );

      default:
        return (
          <div style={{ color: '#999', padding: '20px 0' }}>
            暂未实现此节点 React 版本的复杂配置项表单，目前仅支持修改名称。
          </div>
        );
    }
  };

  return (
    <Form form={form} layout="vertical" onValuesChange={handleValuesChange}>
      <Form.Item name="name" label="节点名称" rules={[{ required: true }]}>
        <Input />
      </Form.Item>
      
      {renderSpecificFields()}
    </Form>
  );
};

export default NodeForm;
