import React, { createContext, useContext, useEffect, useState } from 'react';
import type { Session } from '../types';

const TOKEN_KEY = 'mk-session-token';
const SESSION_CACHE_KEY = 'mk-session-cache';

interface AuthValue {
  session: Session | null;
  loading: boolean;
  login: (password: string) => Promise<Session>;
  logout: () => void;
  updatePassword: (currentPass: string, newPass: string) => Promise<void>;
}

const AuthContext = createContext<AuthValue>({
  session: null,
  loading: true,
  login: async () => {
    throw new Error('not ready');
  },
  logout: () => {},
  updatePassword: async () => {
    throw new Error('not ready');
  }
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(() => {
    try {
      // Purge any legacy plaintext admin password from localStorage if present
      localStorage.removeItem('mk-admin-pass');
      localStorage.removeItem('mk-session');

      const cached = localStorage.getItem(SESSION_CACHE_KEY);
      const token = localStorage.getItem(TOKEN_KEY);
      if (token && cached) {
        return JSON.parse(cached) as Session;
      }
    } catch {}
    return null;
  });

  const [loading, setLoading] = useState(true);

  // Verify session on mount with server
  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      setSession(null);
      setLoading(false);
      return;
    }

    fetch('/api/auth/verify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      }
    })
      .then((res) => res.json())
      .then((data) => {
        if (data && data.valid && data.session) {
          setSession(data.session);
          localStorage.setItem(SESSION_CACHE_KEY, JSON.stringify(data.session));
        } else {
          // Token invalid or expired
          logout();
        }
      })
      .catch(() => {
        // Network offline or error - keep cached session if valid format
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const login = async (password: string): Promise<Session> => {
    const pass = password.trim();
    if (!pass) {
      throw new Error('পাসওয়ার্ড প্রদান করা আবশ্যক।');
    }

    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ password: pass })
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'লগইন ব্যর্থ হয়েছে। পাসওয়ার্ড সঠিক নয়।');
    }

    const nextSession: Session = data.session || {
      role: 'admin',
      name: 'Administrator'
    };

    localStorage.setItem(TOKEN_KEY, data.token);
    localStorage.setItem(SESSION_CACHE_KEY, JSON.stringify(nextSession));
    setSession(nextSession);
    return nextSession;
  };

  const logout = () => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) {
      fetch('/api/auth/logout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      }).catch(() => {});
    }

    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(SESSION_CACHE_KEY);
    localStorage.removeItem('mk-admin-pass');
    localStorage.removeItem('mk-session');
    setSession(null);
  };

  const updatePassword = async (currentPass: string, newPass: string): Promise<void> => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      throw new Error('অনুগ্রহ করে আবার লগইন করুন।');
    }

    const res = await fetch('/api/auth/change-password', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        currentPassword: currentPass,
        newPassword: newPass
      })
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'পাসওয়ার্ড পরিবর্তন ব্যর্থ হয়েছে।');
    }
  };

  return (
    <AuthContext.Provider value={{ session, loading, login, logout, updatePassword }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
