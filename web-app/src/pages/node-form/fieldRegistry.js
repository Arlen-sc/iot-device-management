/**
 * 节点类型 → 表单项组件注册表。
 * 完整约定见：docs/node-form-extensibility.md、.cursor/rules/node-form.mdc
 */
import ScriptNodeFields from './fields/ScriptNodeFields';
import BaseConvertNodeFields from './fields/BaseConvertNodeFields';
import TcpClientNodeFields from './fields/TcpClientNodeFields';
import TcpServerNodeFields from './fields/TcpServerNodeFields';
import TcpListenNodeFields from './fields/TcpListenNodeFields';
import DelayNodeFields from './fields/DelayNodeFields';
import LogNodeFields from './fields/LogNodeFields';
import HttpRequestNodeFields from './fields/HttpRequestNodeFields';
import ConditionNodeFields from './fields/ConditionNodeFields';
import DbOperationNodeFields from './fields/DbOperationNodeFields';
import DataCleaningNodeFields from './fields/DataCleaningNodeFields';
import DeviceDataNodeFields from './fields/DeviceDataNodeFields';
import DeviceControlNodeFields from './fields/DeviceControlNodeFields';
import DedupFilterNodeFields from './fields/DedupFilterNodeFields';
import PlcReadFields from './fields/PlcReadFields';
import PlcWriteFields from './fields/PlcWriteFields';

/** 中文注释：与画布 data.type 一致；TCP_SEND 与 TCP_CLIENT 共用客户端表单 */
export const NODE_FIELD_COMPONENTS = {
  SCRIPT: ScriptNodeFields,
  BASE_CONVERT: BaseConvertNodeFields,
  TCP_SEND: TcpClientNodeFields,
  TCP_CLIENT: TcpClientNodeFields,
  TCP_SERVER: TcpServerNodeFields,
  TCP_LISTEN: TcpListenNodeFields,
  DELAY: DelayNodeFields,
  LOG: LogNodeFields,
  HTTP_REQUEST: HttpRequestNodeFields,
  CONDITION: ConditionNodeFields,
  DB_OPERATION: DbOperationNodeFields,
  DATA_CLEANING: DataCleaningNodeFields,
  DEVICE_DATA: DeviceDataNodeFields,
  DEVICE_CONTROL: DeviceControlNodeFields,
  DEDUP_FILTER: DedupFilterNodeFields,
  PLC_READ: PlcReadFields,
  PLC_WRITE: PlcWriteFields,
};

/**
 * @param {string|undefined} type
 */
export function getNodeFieldComponent(type) {
  if (!type) return null;
  return NODE_FIELD_COMPONENTS[type] ?? null;
}
