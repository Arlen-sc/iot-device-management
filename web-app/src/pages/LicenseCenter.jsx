import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Card, Input, Space, Tag, Typography, message } from 'antd';
import { activateLicense, fetchLicenseStatus } from '../utils/license';

const { Title, Text, Paragraph } = Typography;

/**
 * 软件注册中心页面。
 */
const LicenseCenter = () => {
  const [loading, setLoading] = useState(false);
  const [licenseCode, setLicenseCode] = useState('');
  const [status, setStatus] = useState(null);

  /**
   * 加载授权状态。
   */
  const loadStatus = async () => {
    setLoading(true);
    try {
      const data = await fetchLicenseStatus();
      setStatus(data);
    } catch (err) {
      message.error('获取授权状态失败: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStatus();
  }, []);

  /**
   * 处理授权码激活。
   */
  const handleActivate = async () => {
    if (!licenseCode.trim()) {
      message.warning('请输入授权码');
      return;
    }
    setLoading(true);
    try {
      await activateLicense(licenseCode.trim());
      message.success('授权激活成功');
      setLicenseCode('');
      await loadStatus();
    } catch (err) {
      message.error('授权激活失败: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  /**
   * 计算授权模式标签。
   */
  const modeTag = useMemo(() => {
    if (!status) {
      return <Tag>未知</Tag>;
    }
    if (status.mode === 'LICENSED') {
      return <Tag color="success">正式授权</Tag>;
    }
    return <Tag color="warning">试用授权</Tag>;
  }, [status]);

  return (
    <div className="page-container">
      <Card bordered={false} style={{ borderRadius: 8 }}>
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          <Title level={4} style={{ margin: 0 }}>软件注册中心</Title>

          {status && (
            <Alert
              showIcon
              type={status.valid ? 'success' : 'error'}
              message={status.message}
            />
          )}

          <Card size="small" title="当前授权信息">
            <Space direction="vertical" size={8}>
              <Text>授权模式：{modeTag}</Text>
              <Text>机器码：<Text code>{status?.machineCode || '-'}</Text></Text>
              <Text>到期时间：{status?.expireAt || '-'}</Text>
              <Text>剩余天数：{status?.remainingDays ?? '-'}</Text>
              <Text>任务数量：{status?.currentTasks ?? 0} / {status?.maxTasks ?? 0}</Text>
              <Paragraph style={{ marginBottom: 0 }}>
                功能权限：
                {(status?.features || []).map((item) => (
                  <Tag key={item} color="blue" style={{ marginLeft: 8 }}>{item}</Tag>
                ))}
              </Paragraph>
            </Space>
          </Card>

          <Card size="small" title="激活授权码">
            <Space direction="vertical" style={{ width: '100%' }}>
              <Input.TextArea
                rows={4}
                placeholder="请粘贴授权码"
                value={licenseCode}
                onChange={(e) => setLicenseCode(e.target.value)}
              />
              <Space>
                <Button type="primary" loading={loading} onClick={handleActivate}>
                  激活
                </Button>
                <Button loading={loading} onClick={loadStatus}>
                  刷新状态
                </Button>
              </Space>
            </Space>
          </Card>
        </Space>
      </Card>
    </div>
  );
};

export default LicenseCenter;
