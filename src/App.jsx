import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SupabaseProvider } from './context/SupabaseContext';

import Login from './pages/Login';
import AppShell from './components/layout/AppShell';
import Dashboard from './pages/Dashboard';
import Soldiers from './pages/Soldiers';
import Calendar from './pages/Calendar';
import Logistics from './pages/Logistics';
import Rations from './pages/Rations';
import Reports from './pages/Reports';
import AuditLog from './pages/AuditLog';
import AdminPanel from './pages/AdminPanel';
import MyMissions from './pages/MyMissions';
import { hasRole } from './utils/rbac';

function ProtectedRoute({ children, minRole }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen bg-slate-100 flex items-center justify-center"><div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>;
  if (!user) return <Navigate to="/login" replace />;
  if (minRole && !hasRole(user.role, minRole)) return <Navigate to="/" replace />;
  return children;
}

function LoginGate() {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen bg-slate-100 flex items-center justify-center"><div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>;
  if (user) return <Navigate to="/" replace />;
  return <Login />;
}

function AppRoutes() {
  const { user } = useAuth();
  const isLohem = user?.role === 'lohem';

  return (
    <SupabaseProvider>
      <Routes>
        <Route path="/login" element={<LoginGate />} />
        <Route path="/" element={<ProtectedRoute><AppShell /></ProtectedRoute>}>
          <Route index element={isLohem ? <MyMissions /> : <Dashboard />} />
          <Route path="soldiers" element={<ProtectedRoute minRole="samal"><Soldiers /></ProtectedRoute>} />
          <Route path="calendar" element={<Calendar />} />
          <Route path="logistics" element={<ProtectedRoute minRole="rasap"><Logistics /></ProtectedRoute>} />
          <Route path="rations" element={<ProtectedRoute minRole="rasap"><Rations /></ProtectedRoute>} />
          <Route path="reports" element={<ProtectedRoute minRole="rasap"><Reports /></ProtectedRoute>} />
          <Route path="audit" element={<ProtectedRoute minRole="mefaked"><AuditLog /></ProtectedRoute>} />
          <Route path="admin" element={<ProtectedRoute minRole="mefaked"><AdminPanel /></ProtectedRoute>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </SupabaseProvider>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
