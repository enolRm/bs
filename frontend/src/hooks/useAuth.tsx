import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { ethers } from 'ethers';
import { authApi } from '../api';
import { SIGNATURE_MESSAGE_TEMPLATE } from '../constants';

export type User = {
  address: string;
  role: string;
  created_at: string;
};

interface AuthContextType {
  user: User | null;
  loading: boolean;
  error: string | null;
  login: () => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMe = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      setLoading(false);
      return;
    }

    try {
      const userData = await authApi.getMe();
      setUser(userData);
    } catch (err) {
      console.error('Failed to fetch user', err);
      localStorage.removeItem('token');
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMe();
  }, [fetchMe]);

  const login = async () => {
    setError(null);
    setLoading(true);

    if (!(window as any).ethereum) {
      setError('Please install MetaMask');
      setLoading(false);
      return;
    }

    try {
      const provider = new ethers.BrowserProvider((window as any).ethereum);
      const accounts = await provider.send("eth_requestAccounts", []);
      const address = accounts[0];

      // 1. Get nonce
      const { nonce } = await authApi.getNonce(address);

      // 2. Sign message
      const signer = await provider.getSigner();
      const message = SIGNATURE_MESSAGE_TEMPLATE.replace('{nonce}', nonce);
      const signature = await signer.signMessage(message);

      // 3. Login
      const { access_token } = await authApi.login(address, signature);
      localStorage.setItem('token', access_token);

      // 4. Fetch user info
      await fetchMe();
    } catch (err: any) {
      console.error('Login failed', err);
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, error, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
