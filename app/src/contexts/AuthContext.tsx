import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { authApi, type User } from '@/lib/api/auth';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (email: string, password: string, name?: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useLocalStorage<string | null>('auth-token', null);
  const [isLoading, setIsLoading] = useState(true);

  // Check for existing session on mount
  useEffect(() => {
    if (token) {
      // In production, validate token and get user info
      // For now, we'll just clear it if it's invalid
      setIsLoading(false);
    } else {
      setIsLoading(false);
    }
  }, [token]);

  const login = useCallback(async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const response = await authApi.login({ email, password });
      
      if (response.error) {
        return { success: false, error: response.error };
      }

      if (response.data) {
        setUser(response.data.user);
        setToken(response.data.token);
        return { success: true };
      }

      return { success: false, error: 'Login failed' };
    } finally {
      setIsLoading(false);
    }
  }, [setToken]);

  const register = useCallback(async (email: string, password: string, name?: string) => {
    setIsLoading(true);
    try {
      const response = await authApi.register({ email, password, name });
      
      if (response.error) {
        return { success: false, error: response.error };
      }

      if (response.data) {
        setUser(response.data.user);
        setToken(response.data.token);
        return { success: true };
      }

      return { success: false, error: 'Registration failed' };
    } finally {
      setIsLoading(false);
    }
  }, [setToken]);

  const logout = useCallback(() => {
    setUser(null);
    setToken(null);
  }, [setToken]);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        register,
        logout,
      }}
    >
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
