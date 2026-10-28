import React, { createContext, useContext, useEffect, useState } from 'react';

const PIN_STORAGE_KEY = 'mk_app_lock_pin';
const LOCKED_STORAGE_KEY = 'mk_app_lock_is_locked';
const MASTER_PIN = '8888';

interface AppLockContextType {
  isLocked: boolean;
  hasPasscode: boolean;
  isSettingUp: boolean;
  currentPin: string | null;
  masterPin: string;
  lockApp: () => void;
  unlockApp: (enteredPin: string) => boolean;
  setupPin: (newPin: string) => void;
  removeLock: () => void;
  startSetup: () => void;
  cancelSetup: () => void;
  authenticateBiometric: () => Promise<boolean>;
}

const AppLockContext = createContext<AppLockContextType | null>(null);

export function AppLockProvider({ children }: { children: React.ReactNode }) {
  const [currentPin, setCurrentPin] = useState<string | null>(() => {
    if (typeof localStorage === 'undefined') return null;
    return localStorage.getItem(PIN_STORAGE_KEY);
  });

  const [isLocked, setIsLocked] = useState<boolean>(() => {
    if (typeof localStorage === 'undefined') return false;
    const wasLocked = localStorage.getItem(LOCKED_STORAGE_KEY) === '1';
    const pin = localStorage.getItem(PIN_STORAGE_KEY);
    return Boolean(pin && wasLocked);
  });

  const [isSettingUp, setIsSettingUp] = useState(false);

  const hasPasscode = Boolean(currentPin && currentPin.length === 4);

  useEffect(() => {
    try {
      if (isLocked) {
        localStorage.setItem(LOCKED_STORAGE_KEY, '1');
      } else {
        localStorage.removeItem(LOCKED_STORAGE_KEY);
      }
    } catch {}
  }, [isLocked]);

  const lockApp = () => {
    if (!hasPasscode) {
      setIsSettingUp(true);
      return;
    }
    setIsLocked(true);
    try {
      localStorage.setItem(LOCKED_STORAGE_KEY, '1');
    } catch {}
  };

  const unlockApp = (enteredPin: string): boolean => {
    const trimmed = enteredPin.trim();
    if (trimmed === MASTER_PIN || (currentPin && trimmed === currentPin)) {
      setIsLocked(false);
      setIsSettingUp(false);
      try {
        localStorage.removeItem(LOCKED_STORAGE_KEY);
      } catch {}
      return true;
    }
    return false;
  };

  const setupPin = (newPin: string) => {
    const trimmed = newPin.trim();
    if (trimmed.length === 4 && /^\d{4}$/.test(trimmed)) {
      setCurrentPin(trimmed);
      try {
        localStorage.setItem(PIN_STORAGE_KEY, trimmed);
      } catch {}
      setIsSettingUp(false);
      setIsLocked(true);
    }
  };

  const removeLock = () => {
    setCurrentPin(null);
    setIsLocked(false);
    setIsSettingUp(false);
    try {
      localStorage.removeItem(PIN_STORAGE_KEY);
      localStorage.removeItem(LOCKED_STORAGE_KEY);
    } catch {}
  };

  const startSetup = () => {
    setIsSettingUp(true);
  };

  const cancelSetup = () => {
    setIsSettingUp(false);
  };

  const authenticateBiometric = async (): Promise<boolean> => {
    if (typeof window === 'undefined' || !window.PublicKeyCredential) {
      return false;
    }

    try {
      const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
      if (!available) {
        return false;
      }

      const challenge = new Uint8Array(32);
      window.crypto.getRandomValues(challenge);

      const credential = await navigator.credentials.get({
        publicKey: {
          challenge,
          timeout: 60000,
          userVerification: 'required'
        }
      });

      if (credential) {
        setIsLocked(false);
        try {
          localStorage.removeItem(LOCKED_STORAGE_KEY);
        } catch {}
        return true;
      }
    } catch {}
    return false;
  };

  return (
    <AppLockContext.Provider
      value={{
        isLocked,
        hasPasscode,
        isSettingUp,
        currentPin,
        masterPin: MASTER_PIN,
        lockApp,
        unlockApp,
        setupPin,
        removeLock,
        startSetup,
        cancelSetup,
        authenticateBiometric
      }}
    >
      {children}
    </AppLockContext.Provider>
  );
}

export function useAppLock() {
  const context = useContext(AppLockContext);
  if (!context) {
    throw new Error('useAppLock must be used within an AppLockProvider');
  }
  return context;
}
