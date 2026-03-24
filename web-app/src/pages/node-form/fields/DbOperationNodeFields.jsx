import React from 'react';
import { Form, Input, Select } from 'antd';

const { TextArea } = Input;
const { Option } = Select;

/**
 * 中文注释：DB_OPERATION 数据库操作节点（sql 为空时显示表名）
 */
export default function DbOperationNodeFields({ form, dataSourceOptions = [] }) {
  const dbSqlValue = Form.useWatch('sql', form);
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
        <TextArea rows={3} placeholder={'如输入此项，将优先执行自定义 SQL。支持 \u0024{var} 占位符'} />
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
}
