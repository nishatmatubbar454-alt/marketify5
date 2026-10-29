import React, { useEffect, useState } from 'react';
import { Download, Star, X, Smartphone, Share, PlusSquare } from 'lucide-react';
import { recordAppInstall } from '../utils/analytics';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export function AppInstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [dismissed, setDismissed] = useState(() => {
    try {
      return sessionStorage.getItem('mk-dismiss-install-banner') === '1';
    } catch {
      return false;
    }
  });
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // Check if already installed
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    if (isStandalone) {
      setIsInstalled(true);
      return;
    }

    // Detect iOS
    const ua = window.navigator.userAgent.toLowerCase();
    const isIOSDevice = /iphone|ipad|ipod/.test(ua);
    setIsIOS(isIOSDevice);

    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
      // Track install in Firebase RTDB & backend
      recordAppInstall(isIOSDevice ? 'iOS' : 'Android');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleInstalled);
    };
  }, []);

  const [showGuideModal, setShowGuideModal] = useState(false);

  const handleInstallClick = async () => {
    // Record download intent in Firebase RTDB
    recordAppInstall(isIOS ? 'iOS' : 'Android');

    if (deferredPrompt) {
      try {
        await deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
          setIsInstalled(true);
          setDeferredPrompt(null);
        }
      } catch {}
      return;
    }

    setShowGuideModal(true);
  };

  const handleDismiss = () => {
    setDismissed(true);
    try {
      sessionStorage.setItem('mk-dismiss-install-banner', '1');
    } catch {}
  };

  if (isInstalled || dismissed) {
    return null;
  }

  return (
    <>
      {/* Top Floating Smart App Banner */}
      <aside
        aria-label="App Download Banner"
        className="sticky top-0 z-50 w-full bg-[#1e1c19] text-white border-b border-amber-500/30 px-3 py-2 shadow-lg transition-all animate-in fade-in slide-in-from-top-2 duration-200"
      >
        <div className="mx-auto flex max-w-[1100px] items-center justify-between gap-2.5">
          {/* Close Button */}
          <button
            type="button"
            onClick={handleDismiss}
            aria-label="Dismiss banner"
            className="grid h-7 w-7 place-items-center rounded-full text-white/60 hover:bg-white/10 hover:text-white transition-colors shrink-0"
          >
            <X size={16} />
          </button>

          {/* App Icon */}
          <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-xl bg-black border border-amber-500/40 shadow-md">
            <img
              src="/app-logo.png"
              alt="Marketify App"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).src =
                  'https://i.ibb.co.com/tMC2RhNn/Background-Eraser-20261025-115031994.jpg';
              }}
              className="h-full w-full object-contain p-0.5"
            />
          </div>

          {/* App Info */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 leading-none">
              <h3 className="text-[13px] sm:text-[14px] font-bold text-white tracking-tight truncate">
                Marketify App
              </h3>
              <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[9px] font-semibold text-amber-400 border border-amber-500/30">
                PRO
              </span>
            </div>
            <p className="mt-0.5 text-[11px] text-white/70 truncate">
              কম এমবি খরচ • সুপার ফাস্ট ভিডিও
            </p>
            <div className="mt-0.5 flex items-center gap-1 text-[10px] text-amber-400">
              <div className="flex items-center">
                <Star size={10} fill="#f59e0b" />
                <Star size={10} fill="#f59e0b" />
                <Star size={10} fill="#f59e0b" />
                <Star size={10} fill="#f59e0b" />
                <Star size={10} fill="#f59e0b" />
              </div>
              <span className="text-white/50">(১২K+ ডাউনলোড)</span>
            </div>
          </div>

          {/* Action / Install Button */}
          <button
            type="button"
            onClick={handleInstallClick}
            className="flex items-center gap-1.5 rounded-full bg-gradient-to-r from-[#ff7a18] to-[#ea580c] px-3.5 sm:px-4 py-2 text-[12px] sm:text-[13px] font-bold text-white shadow-md hover:brightness-110 active:scale-95 transition-all shrink-0"
          >
            <Download size={14} className="stroke-[2.5]" />
            <span>ইনস্টল করুন</span>
          </button>
        </div>
      </aside>

      {/* Install Instructions Guide Modal */}
      {showGuideModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-sm rounded-2xl bg-[#1c1c1e] text-white p-5 border border-white/10 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <div className="h-9 w-9 rounded-xl overflow-hidden bg-black border border-amber-500/40 p-0.5">
                  <img src="/app-logo.png" alt="" className="h-full w-full object-contain" />
                </div>
                <div>
                  <h4 className="font-bold text-[15px] leading-tight">Marketify অ্যাপ ডাউনলোড</h4>
                  <p className="text-[11px] text-white/60">মোবাইল স্ক্রিনে সহজে যোগ করুন</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowGuideModal(false)}
                className="grid h-7 w-7 place-items-center rounded-full text-white/60 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            <div className="py-4 space-y-3 text-[13px] text-white/80">
              {isIOS ? (
                <>
                  <div className="flex items-start gap-3 rounded-xl bg-white/5 p-3">
                    <Share size={20} className="text-sky-400 shrink-0 mt-0.5" />
                    <p>
                      ১. Safari ব্রাউজারের নিচে থাকা <strong className="text-white">Share</strong> বাটনে চাপুন।
                    </p>
                  </div>
                  <div className="flex items-start gap-3 rounded-xl bg-white/5 p-3">
                    <PlusSquare size={20} className="text-amber-400 shrink-0 mt-0.5" />
                    <p>
                      ২. নিচে স্ক্রোল করে <strong className="text-white">Add to Home Screen</strong> চাপুন।
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-start gap-3 rounded-xl bg-white/5 p-3">
                    <Smartphone size={20} className="text-amber-400 shrink-0 mt-0.5" />
                    <p>
                      ১. ব্রাউজারের উপরে ডানদিকের ৩টি ডট (<strong className="text-white">⋮</strong>) মেনুতে চাপুন।
                    </p>
                  </div>
                  <div className="flex items-start gap-3 rounded-xl bg-white/5 p-3">
                    <Download size={20} className="text-green-400 shrink-0 mt-0.5" />
                    <p>
                      ২. <strong className="text-white">Install app</strong> অথবা <strong className="text-white">Add to Home screen</strong> চাপলেই ডাউনলোড সম্পন্ন হবে।
                    </p>
                  </div>
                </>
              )}
            </div>

            <button
              type="button"
              onClick={() => setShowGuideModal(false)}
              className="w-full rounded-xl bg-gradient-to-r from-[#ff7a18] to-[#ea580c] py-2.5 text-sm font-bold text-white shadow-md active:scale-95 transition-all"
            >
              ঠিক আছে
            </button>
          </div>
        </div>
      )}
    </>
  );
}
