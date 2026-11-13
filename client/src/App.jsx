import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import Login from './pages/Login';
import Register from './pages/Register';
import Library from './pages/Library';
import Upload from './pages/Upload';
import Templates from './pages/Templates';
import Review from './pages/Review';

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public Auth Routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* Protected Application Workspace */}
          <Route
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route path="/" element={<Navigate to="/library" replace />} />
            <Route path="/library" element={<Library />} />
            <Route
              path="/upload"
              element={
                <ProtectedRoute allowedRoles={['admin', 'employee', 'reviewer']}>
                  <Upload />
                </ProtectedRoute>
              }
            />
            <Route
              path="/templates"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <Templates />
                </ProtectedRoute>
              }
            />
            <Route
              path="/review/:id"
              element={
                <ProtectedRoute allowedRoles={['admin', 'reviewer', 'employee', 'viewer']}>
                  <Review />
                </ProtectedRoute>
              }
            />
          </Route>

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/library" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
