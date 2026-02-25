import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from '@/components/ui/sonner';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import Dashboard from '@/pages/Dashboard';
import Projects from '@/pages/Projects';
import ProjectDetail from '@/pages/ProjectDetail';
import GanttView from '@/pages/GanttView';
import PurchaseOrders from '@/pages/PurchaseOrders';
import AdminPanel from '@/pages/AdminPanel';
import DashboardLayout from '@/components/DashboardLayout';
import '@/App.css';

const PrivateRoute = ({ children }) => {
  const { user } = useAuth();
  return user ? children : <Navigate to="/login" />;
};

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/" element={<PrivateRoute><DashboardLayout /></PrivateRoute>}>
            <Route index element={<Dashboard />} />
            <Route path="projects" element={<Projects />} />
            <Route path="projects/:id" element={<ProjectDetail />} />
            <Route path="gantt" element={<GanttView />} />
            <Route path="purchase-orders" element={<PurchaseOrders />} />
            <Route path="admin" element={<AdminPanel />} />
          </Route>
        </Routes>
        <Toaster position="top-right" />
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;