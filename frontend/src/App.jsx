import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store';
import { ToastProvider } from './components/Toast';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import ExamInterface from './components/ExamInterface';
import AdminDashboard from './components/AdminDashboard';

const TEST_TAKERS = ['candidate', 'intern', 'developer'];

function PrivateRoute({ children, roles }) {
  const { isAuthenticated, user } = useAuthStore();
  if (!isAuthenticated) return <Navigate to="/" />;
  if (roles && !roles.includes(user?.type)) {
    if (!user) return <Navigate to="/" />;
    return <Navigate to={user.type === 'admin' ? '/admin' : '/dashboard'} />;
  }
  return children;
}

function App() {
  const { checkAuth } = useAuthStore();

  useEffect(() => {
    checkAuth();
  }, []);

  return (
    <ToastProvider>
      <Router>
        <Routes>
          <Route path="/" element={<Login />} />
          <Route
            path="/dashboard"
            element={
              <PrivateRoute roles={TEST_TAKERS}>
                <Dashboard />
              </PrivateRoute>
            }
          />
          <Route
            path="/exam/:testId"
            element={
              <PrivateRoute roles={TEST_TAKERS}>
                <ExamInterface />
              </PrivateRoute>
            }
          />
          <Route
            path="/admin"
            element={
              <PrivateRoute roles={['admin']}>
                <AdminDashboard />
              </PrivateRoute>
            }
          />
        </Routes>
      </Router>
    </ToastProvider>
  );
}

export default App;
