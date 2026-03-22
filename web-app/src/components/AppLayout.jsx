import { Layout, Menu } from 'antd';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  AppstoreOutlined, 
  SettingOutlined, 
  ApiOutlined,
  DatabaseOutlined,
  AlertOutlined,
  NodeIndexOutlined
} from '@ant-design/icons';
import React from 'react';

const { Header, Content, Sider } = Layout;

const AppLayout = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();

  const menuItems = [
    { key: '/tasks', icon: <NodeIndexOutlined />, label: '任务流管理' },
    { key: '/devices', icon: <AppstoreOutlined />, label: '设备管理' },
    { key: '/categories', icon: <SettingOutlined />, label: '设备分类' },
    { key: '/datasources', icon: <DatabaseOutlined />, label: '数据源管理' },
    { key: '/bridges', icon: <ApiOutlined />, label: '数据桥接' },
    { key: '/alerts', icon: <AlertOutlined />, label: '告警管理' },
  ];

  // 计算当前选中的菜单项（兼容带参数的子路由，比如 /designer/1）
  const selectedKey = menuItems.find(item => location.pathname.startsWith(item.key))?.key || '/tasks';

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider theme="light" width={220} style={{ borderRight: '1px solid #f0f0f0' }}>
        <div style={{ height: 64, display: 'flex', alignItems: 'center', padding: '0 24px', fontSize: 18, fontWeight: 'bold', color: '#1890ff', borderBottom: '1px solid #f0f0f0' }}>
          IoT 流程引擎
        </div>
        <Menu
          mode="inline"
          selectedKeys={[selectedKey]}
          style={{ height: 'calc(100% - 64px)', borderRight: 0, padding: '12px 0' }}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
        />
      </Sider>
      <Layout>
        <Header style={{ background: '#fff', padding: 0, borderBottom: '1px solid #f0f0f0', display: 'flex', alignItems: 'center' }}>
          <div style={{ padding: '0 24px', fontSize: 16, fontWeight: 500 }}>
            {menuItems.find(item => item.key === selectedKey)?.label || '详情'}
          </div>
        </Header>
        <Content style={{ margin: '24px', background: '#fff', borderRadius: 8, minHeight: 280 }}>
          {children}
        </Content>
      </Layout>
    </Layout>
  );
};

export default AppLayout;