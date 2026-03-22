import React, { useState } from 'react';
import { Layout, Menu, Button } from 'antd';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  AppstoreOutlined, 
  SettingOutlined, 
  ApiOutlined, 
  DatabaseOutlined,
  AlertOutlined,
  DashboardOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined
} from '@ant-design/icons';

const { Header, Sider, Content } = Layout;

const AppLayout = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  
  const menuItems = [
    { key: '/tasks', icon: <AppstoreOutlined />, label: '任务流管理' },
    { key: '/devices', icon: <ApiOutlined />, label: '设备管理' },
    { key: '/categories', icon: <DatabaseOutlined />, label: '设备分类' },
    { key: '/datasources', icon: <DatabaseOutlined />, label: '数据源管理' },
    { key: '/bridges', icon: <ApiOutlined />, label: '数据桥接' },
    { key: '/alerts', icon: <AlertOutlined />, label: '告警管理' },
    { key: '/settings', icon: <SettingOutlined />, label: '系统设置' },
  ];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider 
        collapsible 
        collapsed={collapsed} 
        onCollapse={(value) => setCollapsed(value)}
        width={240}
        style={{
          boxShadow: '2px 0 8px 0 rgba(29,35,41,.05)',
          zIndex: 10
        }}
      >
        <div style={{ 
          height: 64, 
          margin: 16, 
          background: 'rgba(255, 255, 255, 0.1)', 
          borderRadius: 8,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          fontWeight: 'bold',
          fontSize: collapsed ? 12 : 16,
          transition: 'all 0.3s'
        }}>
          {collapsed ? 'IoT' : 'IoT Device Platform'}
        </div>
        <Menu 
          theme="dark" 
          mode="inline" 
          selectedKeys={[location.pathname]} 
          items={menuItems}
          onClick={({ key }) => navigate(key)}
          style={{ borderRight: 0, padding: '0 8px' }}
        />
      </Sider>
      <Layout>
        <Header style={{ 
          padding: '0 24px', 
          background: '#fff',
          boxShadow: '0 1px 4px rgba(0,21,41,.08)',
          display: 'flex',
          alignItems: 'center',
          zIndex: 9
        }}>
          <Button
            type="text"
            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={() => setCollapsed(!collapsed)}
            style={{
              fontSize: '16px',
              width: 64,
              height: 64,
              marginLeft: -24
            }}
          />
          <div style={{ flex: 1 }}></div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <span style={{ color: '#475569', fontWeight: 500 }}>Admin User</span>
            <div style={{ 
              width: 32, 
              height: 32, 
              borderRadius: '50%', 
              background: '#4f46e5', 
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 'bold'
            }}>A</div>
          </div>
        </Header>
        <Content style={{ 
          margin: '24px 16px', 
          overflow: 'initial',
          minHeight: 280
        }}>
          {children}
        </Content>
      </Layout>
    </Layout>
  );
};

export default AppLayout;