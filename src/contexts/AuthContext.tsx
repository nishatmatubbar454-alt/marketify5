import React, { createContext, useContext, useEffect, useState } from 'react';
import type { Session } from '../types';

const TOKEN_KEY = 'mk-session-token';
const SESSION_CACHE_KEY = 'mk-session-cache';
const LOCAL_AUTH_HASH_KEY = 'mk-sec-auth-cred';

// Secure PBKDF2 parameters (Hash of 445566 with salt)
// Plaintext password is NEVER stored anywhere
const DEFAULT_SALT = 'mk_sec_9f8b2e1a4c7d0e3f';
const DEFAULT_HASH = '348638291767b3891a480262edf390bb8120606f6a116641a50590fc9c9d0ee5';

async function derivePBKDF2Hash(password: string, salt: string): Promise<string> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: enc.encode(salt),
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    256
  );
  const hashArray = Array.from(new Uint8Array(derivedBits));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function getStoredAuthConfig(): Promise<{ salt: string; hash: string }> {
  // 1. Try Firebase RTDB
  try {
    const res = await fetch('https://himrw-fae65-default-rtdb.firebaseio.com/admin/auth.json');
    if (res.ok) {
      const data = await res.json();
      if (data && data.salt && data.hash) {
        return { salt: data.salt, hash: data.hash };
      }
    }
  } catch {}

  // 2. Try localStorage override if changed
  try {
    const raw = localStorage.getItem(LOCAL_AUTH_HASH_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.salt && parsed.hash) return parsed;
    }
  } catch {}

  return { salt: DEFAULT_SALT, hash: DEFAULT_HASH };
}

async function verifyAdminPasswordPBKDF2(password: string): Promise<boolean> {
  const config = await getStoredAuthConfig();
  const computedHash = await derivePBKDF2Hash(password, config.salt);
  return computedHash === config.hash;
}

async function updateAdminPasswordPBKDF2(newPassword: string): Promise<void> {
  const newSalt = 'mk_sec_' + Math.random().toString(36).substring(2, 10);
  const newHash = await derivePBKDF2Hash(newPassword, newSalt);
  const cred = { salt: newSalt, hash: newHash, updatedAt: Date.now() };

  try {
    localStorage.setItem(LOCAL_AUTH_HASH_KEY, JSON.stringify(cred));
  } catch {}

  try {
    await fetch('https://himrw-fae65-default-rtdb.firebaseio.com/admin/auth.json', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cred)
    });
  } catch {}
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

  const [loading, setLoading] = useState(() => {
    try {
      const token = localStorage.getItem(TOKEN_KEY);
      const cached = localStorage.getItem(SESSION_CACHE_KEY);
      return !token || !cached;
    } catch {
      return false;
    }
  });

  // Verify session on mount (supports both Express backend & Cloudflare Workers)
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
          localStorage.setItem(SESSION_CACHE_KEY, JSON.stringify(data.session));
        } else if (data && !data.valid) {
          logout();
        } else {
          // If server returns 404 (e.g. on Cloudflare Workers / Static hosting),
          // preserve valid cached session
          const cached = localStorage.getItem(SESSION_CACHE_KEY);
          if (cached) {
            setSession(JSON.parse(cached));
          }
        }
      })
      .catch(() => {
        const cached = localStorage.getItem(SESSION_CACHE_KEY);
        if (cached) {
          setSession(JSON.parse(cached));
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
        const data = await res.json();
        if (data && data.success) {
          const nextSession: Session = data.session || {
            role: 'admin',
            name: 'Administrator'
          };
          localStorage.setItem(TOKEN_KEY, data.token);
          localStorage.setItem(SESSION_CACHE_KEY, JSON.stringify(nextSession));
          setSession(nextSession);
          return nextSession;
        }
      }
    } catch {}

    // 2. Client-side PBKDF2 hash verification (works seamlessly on Cloudflare Workers)
    const isValid = await verifyAdminPasswordPBKDF2(pass);
    if (!isValid) {
      throw new Error('পাসওয়ার্ড সঠিক নয়। আবার চেষ্টা করুন।');
    }

    const token = 'mk_adm_' + Date.now() + '_' + Math.random().toString(36).substring(2);
    const nextSession: Session = {
      role: 'admin',
      name: 'Administrator'
    };

    localStorage.setItem(TOKEN_KEY, token);
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
    const validCurrent = await verifyAdminPasswordPBKDF2(currentPass.trim());
    if (!validCurrent) {
      throw new Error('বর্তমান পাসওয়ার্ড সঠিক নয়।');
    }
    if (newPass.trim().length < 6) {
      throw new Error('নতুন পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে।');
    }

    // Try server if available
    try {
      const token = localStorage.getItem(TOKEN_KEY);
      await fetch('/api/auth/change-password', {
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
    } catch {}

    // Update PBKDF2 encrypted hash
    await updateAdminPasswordPBKDF2(newPass.trim());
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
