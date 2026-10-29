import { ref as rtdbRef, set as rtdbSet, get as rtdbGet, onValue as rtdbOnValue } from 'firebase/database';
import { realtimeDb } from '../lib/firebase';
import { useEffect, useState } from 'react';

const DEVICE_ID_KEY = 'mk_device_id';

export function getDeviceId(): string {
  if (typeof localStorage === 'undefined') return 'unknown_device';
  let id = localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = 'dev_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 9);
    try {
      localStorage.setItem(DEVICE_ID_KEY, id);
    } catch {}
  }
  return id;
}

export function detectDevicePlatform(): 'Android' | 'iOS' | 'Desktop' {
  if (typeof window === 'undefined') return 'Desktop';
  const ua = window.navigator.userAgent.toLowerCase();
  if (/iphone|ipad|ipod/.test(ua)) return 'iOS';
  if (/android/.test(ua)) return 'Android';
  return 'Desktop';
}

export function isStandaloneApp(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

// Record an app installation event in Firebase Realtime Database
export async function recordAppInstall(platformOverride?: string) {
  const deviceId = getDeviceId();
  const platform = platformOverride || detectDevicePlatform();
  const now = Date.now();

  // 1. Save to Firebase Realtime Database
  try {
    const installRef = rtdbRef(realtimeDb, `analytics/installedDevices/${deviceId}`);
    await rtdbSet(installRef, {
      deviceId,
      platform,
      installedAt: now,
      lastActiveAt: now,
      isStandalone: true
    });

    // Increment total install counter
    const totalRef = rtdbRef(realtimeDb, 'analytics/totalInstalls');
    const snap = await rtdbGet(totalRef);
    const current = (snap.val() as number) || 0;
    await rtdbSet(totalRef, current + 1);
  } catch (err) {
    console.warn('Could not record install to Firebase:', err);
  }

  // 2. Also call backend fallback endpoint
  try {
    fetch('/api/analytics/app-install', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId, platform })
    }).catch(() => {});
  } catch {}
}

// Track device activity and presence on app load
export function trackDevicePresence() {
  if (typeof window === 'undefined') return;

  const deviceId = getDeviceId();
  const platform = detectDevicePlatform();
  const isInstalled = isStandaloneApp();
  const now = Date.now();

  try {
    // If the app is launched as an installed standalone app, ensure it's tracked in installedDevices
    if (isInstalled) {
      const installedDevRef = rtdbRef(realtimeDb, `analytics/installedDevices/${deviceId}`);
      rtdbGet(installedDevRef)
        .then((snap) => {
          const existing = snap.val();
          rtdbSet(installedDevRef, {
            deviceId,
            platform,
            installedAt: existing?.installedAt || now,
            lastActiveAt: now,
            isStandalone: true
          }).catch(() => {});
        })
        .catch(() => {});
    }

    // Always update last active device ping
    const activeRef = rtdbRef(realtimeDb, `analytics/allActiveDevices/${deviceId}`);
    rtdbSet(activeRef, {
      deviceId,
      platform,
      lastActiveAt: now,
      isStandalone: isInstalled
    }).catch(() => {});
  } catch {}
}

export interface InstalledDevice {
  deviceId: string;
  platform: 'Android' | 'iOS' | 'Desktop';
  installedAt: number;
  lastActiveAt: number;
  isStandalone?: boolean;
}

export interface AppAnalyticsStats {
  totalInstalls: number;
  installedPhonesCount: number;
  androidCount: number;
  iosCount: number;
  desktopCount: number;
  devices: InstalledDevice[];
  loading: boolean;
}

export function useAppAnalytics(): AppAnalyticsStats {
  const [stats, setStats] = useState<AppAnalyticsStats>({
    totalInstalls: 0,
    installedPhonesCount: 0,
    androidCount: 0,
    iosCount: 0,
    desktopCount: 0,
    devices: [],
    loading: true
  });

  useEffect(() => {
    // Realtime listener for analytics node in Firebase RTDB
    const analyticsRef = rtdbRef(realtimeDb, 'analytics');

    const unsubscribe = rtdbOnValue(
      analyticsRef,
      (snapshot) => {
        const val = snapshot.val();
        let totalInstalls = 0;
        let devices: InstalledDevice[] = [];

        if (val && typeof val === 'object') {
          totalInstalls = Number(val.totalInstalls) || 0;

          if (val.installedDevices && typeof val.installedDevices === 'object') {
            devices = Object.values(val.installedDevices) as InstalledDevice[];
          }
        }

        // If totalInstalls is lower than unique devices, use devices length
        const effectiveTotal = Math.max(totalInstalls, devices.length);

        const androidCount = devices.filter((d) => d.platform === 'Android').length;
        const iosCount = devices.filter((d) => d.platform === 'iOS').length;
        const desktopCount = devices.filter((d) => d.platform === 'Desktop').length;

        // Sort devices by last active descending
        devices.sort((a, b) => (b.lastActiveAt || 0) - (a.lastActiveAt || 0));

        setStats({
          totalInstalls: effectiveTotal,
          installedPhonesCount: devices.length,
          androidCount,
          iosCount,
          desktopCount,
          devices,
          loading: false
        });
      },
      () => {
        // Fallback to local server endpoint if Firebase RTDB fails
        fetch('/api/analytics/stats')
          .then((res) => (res.ok ? res.json() : null))
          .then((data) => {
            if (data && data.stats) {
              setStats((prev) => ({
                ...prev,
                totalInstalls: data.stats.appInstalls || 0,
                loading: false
              }));
            }
          })
          .catch(() => {
            setStats((prev) => ({ ...prev, loading: false }));
          });
      }
    );

    return () => {
      unsubscribe();
    };
  }, []);

  return stats;
}
