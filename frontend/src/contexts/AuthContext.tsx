'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import axios from 'axios';
import { setAuthToken } from '@/lib/api';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

interface User {
  id: number;
  email: string;
  name: string | null;
  risk_profile: string | null;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, name?: string) => Promise<void>;
  logout: () => void;
  updateProfile: (data: { name?: string; risk_profile?: string }) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [mounted, setMounted] = useState(false);

  // Handle SSR - only access localStorage after mount
  useEffect(() => {
    setMounted(true);
  }, []);

  // Initialize from localStorage after mount
  useEffect(() => {
    if (!mounted) return;
    
    try {
      const savedToken = localStorage.getItem('authToken');
      const savedUser = localStorage.getItem('authUser');
      
      if (savedToken && savedUser) {
        setToken(savedToken);
        setUser(JSON.parse(savedUser));
        setAuthToken(savedToken); // Set token in API client
        // Verify token is still valid
        verifyToken(savedToken);
      } else {
        setIsLoading(false);
      }
    } catch (error) {
      console.error('Error reading from localStorage:', error);
      setIsLoading(false);
    }
  }, [mounted]);

  const verifyToken = async (tokenToVerify: string) => {
    try {
      const response = await axios.get(`${API_BASE_URL}/auth/me`, {
        headers: { Authorization: `Bearer ${tokenToVerify}` }
      });
      setUser(response.data);
      localStorage.setItem('authUser', JSON.stringify(response.data));
    } catch (error) {
      // Token invalid, clear auth
      localStorage.removeItem('authToken');
      localStorage.removeItem('authUser');
      setToken(null);
      setUser(null);
      setAuthToken(null); // Clear token from API client
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    const response = await axios.post(`${API_BASE_URL}/auth/login`, {
      email,
      password
    });
    
    const { access_token, user: userData } = response.data;
    
    setToken(access_token);
    setUser(userData);
    setAuthToken(access_token); // Set token in API client
    localStorage.setItem('authToken', access_token);
    localStorage.setItem('authUser', JSON.stringify(userData));
  };

  const signup = async (email: string, password: string, name?: string) => {
    const response = await axios.post(`${API_BASE_URL}/auth/signup`, {
      email,
      password,
      name
    });
    
    const { access_token, user: userData } = response.data;
    
    setToken(access_token);
    setUser(userData);
    setAuthToken(access_token); // Set token in API client
    localStorage.setItem('authToken', access_token);
    localStorage.setItem('authUser', JSON.stringify(userData));
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    setAuthToken(null); // Clear token from API client
    localStorage.removeItem('authToken');
    localStorage.removeItem('authUser');
  };

  const updateProfile = async (data: { name?: string; risk_profile?: string }) => {
    if (!token) throw new Error('Not authenticated');
    
    const response = await axios.put(`${API_BASE_URL}/auth/me`, data, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    setUser(response.data);
    localStorage.setItem('authUser', JSON.stringify(response.data));
  };

  return (
    <AuthContext.Provider value={{
      user,
      token,
      isLoading,
      isAuthenticated: !!user,
      login,
      signup,
      logout,
      updateProfile
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
