import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import AppLayout from './components/AppLayout';
import TaskList from './pages/TaskList';
import DeviceList from './pages/DeviceList';
import CategoryList from './pages/CategoryList';
import DataSourceList from './pages/DataSourceList';
import Designer from './pages/Designer';
import LicenseCenter from './pages/LicenseCenter';

function App() {
  return (
    <ConfigProvider
      locale={zhCN}
      theme={{
        token: {
          colorPrimary: '#4f46e5', // Indigo 600
          borderRadius: 8,
          colorBgContainer: '#ffffff',
          fontFamily: `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans', sans-serif`,
        },
        components: {
          Layout: {
            headerBg: '#ffffff',
            siderBg: '#0f172a', // Slate 900
          },
          Menu: {
            darkItemBg: '#0f172a',
            darkItemHoverBg: '#1e293b',
            darkItemSelectedBg: '#4f46e5',
          },
          Table: {
            headerBg: '#f8fafc',
            headerColor: '#475569',
            rowHoverBg: '#f1f5f9',
          }
        },
      }}
    >
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/tasks" replace />} />
          
          {/* Designer is full screen, no layout */}
          <Route path="/designer/:id" element={<Designer />} />
          
          {/* Pages with sidebar layout */}
          <Route element={<AppLayout><div /></AppLayout>}>
            {/* We use a hack here to render children inside the AppLayout by wrapping them */}
          </Route>
          
          <Route path="/tasks" element={<AppLayout><TaskList /></AppLayout>} />
          <Route path="/devices" element={<AppLayout><DeviceList /></AppLayout>} />
          <Route path="/categories" element={<AppLayout><CategoryList /></AppLayout>} />
          <Route path="/datasources" element={<AppLayout><DataSourceList /></AppLayout>} />
          <Route path="/license" element={<AppLayout><LicenseCenter /></AppLayout>} />
          
          {/* Fallback for un-migrated pages */}
          <Route path="/bridges" element={<AppLayout><div className="page-container">数据桥接 (正在迁移至 React...)</div></AppLayout>} />
          <Route path="/alerts" element={<AppLayout><div className="page-container">告警管理 (正在迁移至 React...)</div></AppLayout>} />
        </Routes>
      </BrowserRouter>
    </ConfigProvider>
  );
}

export default App;