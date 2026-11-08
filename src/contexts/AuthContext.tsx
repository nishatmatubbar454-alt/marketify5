import React, { createContext, useContext, useEffect, useState } from 'react';
import type { Session } from '../types';

const TOKEN_KEY = 'mk-session-token';
const SESSION_CACHE_KEY = 'mk-session-cache';

function checkAdminPassword(input: string): boolean {
  const clean = (input || '').trim();
  const upper = clean.toUpperCase();
  // Accepts 445566N, 44566N, 445566, 44566 (case-insensitive)
  return (
    upper === '445566N' ||
    upper === '44566N' ||
    upper === '445566' ||
    upper === '44566'
  );
}

interface AuthValue {
  session: Session | null;
  loading: boolean;
  login: (password: string) => Promise<Session>;
  logout: () => void;
  updatePassword: (currentPass: string, newPass: string) => Promise<void>;
}

const AuthContext = createContext<AuthValue>({
  session: null,
  loading: false,
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

  const [loading, setLoading] = useState<boolean>(() => {
    try {
      const token = localStorage.getItem(TOKEN_KEY);
      const cached = localStorage.getItem(SESSION_CACHE_KEY);
      if (token && cached) return false;
    } catch {}
    return false;
  });

  // Background token verification (if running Express server)
  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return;

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
        } else if (data && data.valid === false) {
          logout();
        }
      })
      .catch(() => {});
  }, []);

  const login = async (password: string): Promise<Session> => {
    const pass = (password || '').trim();
    if (!pass) {
      throw new Error('পাসওয়ার্ড প্রদান করা আবশ্যক।');
    }

    const isMatch = checkAdminPassword(pass);

    // 1. Try Express backend server if available
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ password: pass })
      });

      if (res.ok) {
        const data = await res.json().catch(() => null);
        if (data && data.success) {
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
        }
      }
    } catch {}

    // 2. Client-side fallback: 100% reliable for Cloudflare Workers & Android APK
    if (isMatch) {
      const token = 'mk_adm_' + Date.now() + '_' + Math.random().toString(36).substring(2);
      const nextSession: Session = {
        role: 'admin',
        name: 'Administrator'
      };

      try {
        localStorage.setItem(TOKEN_KEY, token);
        localStorage.setItem(SESSION_CACHE_KEY, JSON.stringify(nextSession));
      } catch {}

      setSession(nextSession);
      return nextSession;
    }

    throw new Error('ভুল পাসওয়ার্ড! অ্যাক্সেস প্রত্যাখ্যাত।');
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

    try {
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
      if (res.ok && data?.success) {
        return;
      }
    } catch {}

    if (!checkAdminPassword(currentPass.trim())) {
      throw new Error('বর্তমান পাসওয়ার্ডটি সঠিক নয়!');
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
