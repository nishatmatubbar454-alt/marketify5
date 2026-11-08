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
      // Clear legacy insecure keys
      localStorage.removeItem('mk-admin-pass');
      localStorage.removeItem('mk-session');
      localStorage.removeItem('mk-sec-auth-cred');

      const cached = localStorage.getItem(SESSION_CACHE_KEY);
      const token = localStorage.getItem(TOKEN_KEY);
      if (token && cached) {
        return JSON.parse(cached) as Session;
      }
    } catch {}
    return null;
  });

  const [loading, setLoading] = useState(true);

  // Verify server-side session on mount
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
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && data.valid && data.session) {
          setSession(data.session);
          try {
            localStorage.setItem(SESSION_CACHE_KEY, JSON.stringify(data.session));
          } catch {}
        } else {
          logout();
        }
      })
      .catch(() => {
        // If network error, preserve cached session temporarily
        const cached = localStorage.getItem(SESSION_CACHE_KEY);
        if (cached) {
          try {
            setSession(JSON.parse(cached));
          } catch {}
        }
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

    const data = await res.json().catch(() => null);

    if (!res.ok || !data?.success) {
      const errMsg = data?.error || 'ভুল পাসওয়ার্ড! অ্যাক্সেস প্রত্যাখ্যাত।';
      throw new Error(errMsg);
    }

    const nextSession: Session = data.session || {
      role: 'admin',
      name: 'Administrator'
    };

    try {
      localStorage.setItem(TOKEN_KEY, data.token);
      localStorage.setItem(SESSION_CACHE_KEY, JSON.stringify(nextSession));
    } catch {}

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

    try {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(SESSION_CACHE_KEY);
      localStorage.removeItem('mk-admin-pass');
      localStorage.removeItem('mk-session');
      localStorage.removeItem('mk-sec-auth-cred');
    } catch {}
    setSession(null);
  };

  const updatePassword = async (currentPass: string, newPass: string): Promise<void> => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      throw new Error('অননুমোদিত: দয়া করে আবার লগইন করুন।');
    }

    if (!currentPass.trim()) {
      throw new Error('বর্তমান পাসওয়ার্ড প্রদান করুন।');
    }

    if (newPass.trim().length < 4) {
      throw new Error('নতুন পাসওয়ার্ড অন্তত ৪ অক্ষরের হতে হবে।');
    }

    const res = await fetch('/api/auth/change-password', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        currentPassword: currentPass.trim(),
        newPassword: newPass.trim()
      })
    });

    const data = await res.json().catch(() => null);

    if (!res.ok || !data?.success) {
      throw new Error(data?.error || 'পাসওয়ার্ড পরিবর্তন ব্যর্থ হয়েছে।');
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
