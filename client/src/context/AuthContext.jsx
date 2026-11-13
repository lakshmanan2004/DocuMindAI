import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../api/client';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('documind_user');
    return saved ? JSON.parse(saved) : null;
  });

  const [organization, setOrganization] = useState(() => {
    const saved = localStorage.getItem('documind_org');
    return saved ? JSON.parse(saved) : null;
  });

  const [token, setToken] = useState(() => localStorage.getItem('documind_token'));
  const [loading, setLoading] = useState(true);

  // Verify token on app mount / browser refresh
  useEffect(() => {
    const verifyUser = async () => {
      const storedToken = localStorage.getItem('documind_token');
      if (!storedToken) {
        setLoading(false);
        return;
      }

      try {
        const { data } = await api.get('/auth/me');
        setUser(data.user);
        setOrganization(data.organization);
        localStorage.setItem('documind_user', JSON.stringify(data.user));
        if (data.organization) {
          localStorage.setItem('documind_org', JSON.stringify(data.organization));
        }
      } catch (err) {
        console.error('Session expired or invalid token:', err);
        logout();
      } finally {
        setLoading(false);
      }
    };

    verifyUser();
  }, []);

  const login = async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    localStorage.setItem('documind_token', data.token);
    localStorage.setItem('documind_user', JSON.stringify(data.user));
    localStorage.setItem('documind_org', JSON.stringify(data.organization));
    setToken(data.token);
    setUser(data.user);
    setOrganization(data.organization);
    return data;
  };

  const register = async (orgName, name, email, password) => {
    const { data } = await api.post('/auth/register-org', {
      orgName,
      name,
      email,
      password
    });
    localStorage.setItem('documind_token', data.token);
    localStorage.setItem('documind_user', JSON.stringify(data.user));
    localStorage.setItem('documind_org', JSON.stringify(data.organization));
    setToken(data.token);
    setUser(data.user);
    setOrganization(data.organization);
    return data;
  };

  const logout = () => {
    localStorage.removeItem('documind_token');
    localStorage.removeItem('documind_user');
    localStorage.removeItem('documind_org');
    setToken(null);
    setUser(null);
    setOrganization(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        organization,
        token,
        loading,
        isAuthenticated: !!token,
        login,
        register,
        logout
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

