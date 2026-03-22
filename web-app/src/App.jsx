import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import AppLayout from './components/AppLayout';
import TaskList from './pages/TaskList';
import DeviceList from './pages/DeviceList';
import CategoryList from './pages/CategoryList';
import Designer from './pages/Designer';

function App() {
  return (
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
        
        {/* Fallback for un-migrated pages */}
        <Route path="/datasources" element={<AppLayout><div style={{padding:24}}>数据源管理 (正在迁移至 React...)</div></AppLayout>} />
        <Route path="/bridges" element={<AppLayout><div style={{padding:24}}>数据桥接 (正在迁移至 React...)</div></AppLayout>} />
        <Route path="/alerts" element={<AppLayout><div style={{padding:24}}>告警管理 (正在迁移至 React...)</div></AppLayout>} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;