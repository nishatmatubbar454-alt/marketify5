import React, { createContext, useContext, useState } from 'react';
import type { Session } from '../types';

const DEFAULT_ADMIN_PASSWORD = '445566';
const STORAGE_KEY = 'mk-session';
const PASS_KEY = 'mk-admin-pass';

interface AuthValue {
  session: Session | null;
  login: (password: string) => Promise<Session>;
  logout: () => void;
  updatePassword: (newPass: string) => void;
  getAdminPassword: () => string;
}

const AuthContext = createContext<AuthValue>({
  session: null,
  login: async () => {
    throw new Error('not ready');
  },
  logout: () => {},
  updatePassword: () => {},
  getAdminPassword: () => DEFAULT_ADMIN_PASSWORD
});

function readSession(): Session | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(readSession);

  const getAdminPassword = (): string => {
    try {
      const saved = localStorage.getItem(PASS_KEY);
      if (saved) return saved;
    } catch {}
    return DEFAULT_ADMIN_PASSWORD;
  };

  const updatePassword = (newPass: string) => {
    localStorage.setItem(PASS_KEY, newPass.trim());
  };

  const login = async (password: string): Promise<Session> => {
    const pass = password.trim();
    if (!pass) throw new Error('Password is required.');
    
    const currentAdminPass = getAdminPassword();
    if (pass !== currentAdminPass) {
      throw new Error('Incorrect password. Access denied.');
    }
    const next: Session = {
      role: 'admin',
      name: 'Administrator'
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setSession(next);
    return next;
  };

  const logout = () => {
    localStorage.removeItem(STORAGE_KEY);
    setSession(null);
  };

  return (
    <AuthContext.Provider value={{ session, login, logout, updatePassword, getAdminPassword }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
