import React from 'react';

/**
 * 中文注释：设备类节点共用的设备信息展示块
 */
export default function DeviceSummaryCard({ device }) {
  if (!device) return null;
  return (
    <div style={{ background: '#f5f5f5', padding: '12px', borderRadius: '6px', marginBottom: '24px', fontSize: '13px' }}>
      <div style={{ marginBottom: '4px' }}>
        <span style={{ color: '#888', marginRight: '8px' }}>设备名称:</span>
        <strong>{device.name}</strong>
      </div>
      <div style={{ marginBottom: '4px' }}>
        <span style={{ color: '#888', marginRight: '8px' }}>通信协议:</span>
        <span style={{ color: '#1890ff' }}>{device.protocolType || '未知'}</span>
      </div>
      <div>
        <span style={{ color: '#888', marginRight: '8px' }}>当前状态:</span>
        <span style={{ color: device.status === 'ONLINE' ? '#52c41a' : '#ff4d4f' }}>
          {device.status === 'ONLINE' ? '🟢 在线' : '🔴 离线'}
        </span>
      </div>
    </div>
  );
}
