import { useEffect, useState } from 'react';

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

let globalDeferredPrompt: BeforeInstallPromptEvent | null = null;
const promptListeners = new Set<(prompt: BeforeInstallPromptEvent | null) => void>();

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    globalDeferredPrompt = e as BeforeInstallPromptEvent;
    promptListeners.forEach((fn) => fn(globalDeferredPrompt));
  });

  window.addEventListener('appinstalled', () => {
    globalDeferredPrompt = null;
    promptListeners.forEach((fn) => fn(null));
  });
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(
    () => globalDeferredPrompt
  );
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showGuideModal, setShowGuideModal] = useState(false);

  useEffect(() => {
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    setIsInstalled(isStandalone);

    const ua = window.navigator.userAgent.toLowerCase();
    setIsIOS(/iphone|ipad|ipod/.test(ua));

    const listener = (p: BeforeInstallPromptEvent | null) => {
      setDeferredPrompt(p);
    };
    promptListeners.add(listener);
    return () => {
      promptListeners.delete(listener);
    };
  }, []);

  const triggerInstall = async (): Promise<boolean> => {
    if (globalDeferredPrompt) {
      try {
        await globalDeferredPrompt.prompt();
        const { outcome } = await globalDeferredPrompt.userChoice;
        if (outcome === 'accepted') {
          setIsInstalled(true);
          globalDeferredPrompt = null;
          setDeferredPrompt(null);
          return true;
        }
      } catch {}
      return false;
    }

    // If deferred prompt hasn't fired or on iOS:
    setShowGuideModal(true);
    return false;
  };

  return {
    isInstallable: !!deferredPrompt,
    isInstalled,
    isIOS,
    showGuideModal,
    setShowGuideModal,
    triggerInstall
  };
}
