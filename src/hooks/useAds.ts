import { useEffect, useMemo, useState } from 'react';
import { onValue, ref as rtdbRef, get as rtdbGet } from 'firebase/database';
import {
  primaryRealtimeDb,
  RTDB_ENDPOINTS,
  fetchRtdbJson,
  dualRtdbSet,
  dualRtdbRemove,
  dualFirestoreSetDoc,
  dualFirestoreDeleteDoc
} from '../lib/firebase';
import { DEFAULT_ADS } from '../data/defaultAds';
import type { Ad } from '../types';

const LOCAL_ADS_KEY = 'mk-local-ads';
const ADS_EVENT = 'marketify-ads-updated';
const ADS_CHANNEL_NAME = 'marketify-ads-sync';

function normalizeAdList(raw: unknown): Ad[] {
  if (!raw || typeof raw !== 'object') return [];
  const entries = Array.isArray(raw)
    ? raw.map((item, idx) => [String(idx), item] as const)
    : Object.entries(raw as Record<string, unknown>);

  const dedup = new Map<string, Ad>();
  for (const [key, item] of entries) {
    if (!item || typeof item !== 'object') continue;
    const obj = item as Partial<Ad>;
    const resolvedId = typeof obj.id === 'string' && obj.id.trim() ? obj.id.trim() : key;
    if (!resolvedId) continue;

    const candidate: Ad = {
      id: resolvedId,
      name: typeof obj.name === 'string' && obj.name.trim() ? obj.name : resolvedId,
      type: obj.type === 'social_bar' || obj.type === 'in_feed' || obj.type === 'banner_468x60'
        ? obj.type
        : 'banner_468x60',
      script: typeof obj.script === 'string' ? obj.script : '',
      status: obj.status === 'on' ? 'on' : 'off',
      placement: typeof obj.placement === 'string' && obj.placement ? obj.placement : 'Public Frontend',
      createdAt: typeof obj.createdAt === 'number' ? obj.createdAt : 0,
      updatedAt: typeof obj.updatedAt === 'number' ? obj.updatedAt : (typeof obj.createdAt === 'number' ? obj.createdAt : 0)
    };

    const existing = dedup.get(resolvedId);
    if (!existing || (candidate.updatedAt || 0) >= (existing.updatedAt || 0)) {
      dedup.set(resolvedId, candidate);
    }
  }

  return Array.from(dedup.values()).sort(
    (a, b) => (a.createdAt || 0) - (b.createdAt || 0)
  );
}

function getLocalAds(): Ad[] {
  try {
    const raw = localStorage.getItem(LOCAL_ADS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      const normalized = normalizeAdList(parsed);
      if (normalized.length > 0) return normalized;
    }
  } catch {}
  return DEFAULT_ADS;
}

function saveLocalAds(list: Ad[]) {
  try {
    localStorage.setItem(LOCAL_ADS_KEY, JSON.stringify(list));
  } catch {}
}

function mergeAdLists(lists: Ad[][]): Ad[] {
  const merged = new Map<string, Ad>();
  for (const list of lists) {
    for (const ad of list) {
      if (!ad || !ad.id) continue;
      const existing = merged.get(ad.id);
      if (!existing || (ad.updatedAt || 0) >= (existing.updatedAt || 0)) {
        merged.set(ad.id, ad);
      }
    }
  }
  return Array.from(merged.values()).sort(
    (a, b) => (a.createdAt || 0) - (b.createdAt || 0)
  );
}

// Global in-memory singleton to keep every component synchronized instantaneously
let sharedAds: Ad[] = getLocalAds();
const subscribers = new Set<(ads: Ad[]) => void>();
let isInitialized = false;
let broadcastChannel: BroadcastChannel | null = null;

function notifySubscribers(next?: Ad[]) {
  if (next) {
    sharedAds = next;
    saveLocalAds(next);
  }
  subscribers.forEach((fn) => fn(sharedAds));
}

function applyAuthoritativeRemoteAds(remote: Ad[]) {
  if (remote.length === 0) return;
  notifySubscribers(remote);
}

async function fetchAdsFromAllSources() {
  const remoteLists: Ad[][] = [];

  // 1. Fetch concurrently from ALL 3 Firebase RTDBs + Express API (no stale cache)
  const rtdbPromises = RTDB_ENDPOINTS.map((endpoint) =>
    fetchRtdbJson<unknown>(endpoint, '/ads.json', 8000)
  );

  const apiPromise = fetch('/api/ads', { cache: 'no-store' })
    .then((res) => (res.ok ? res.json() : null))
    .catch(() => null);

  const [apiResult, ...rtdbResults] = await Promise.allSettled([apiPromise, ...rtdbPromises]);

  for (const r of rtdbResults) {
    if (r.status === 'fulfilled' && r.value) {
      const normalized = normalizeAdList(r.value);
      if (normalized.length > 0) {
        remoteLists.push(normalized);
      }
    }
  }

  if (remoteLists.length > 0) {
    applyAuthoritativeRemoteAds(mergeAdLists(remoteLists));
    return;
  }

  // Fallback to Express API response if Firebase REST didn't return data
  if (apiResult.status === 'fulfilled' && apiResult.value?.success && Array.isArray(apiResult.value.ads)) {
    const normalizedApi = normalizeAdList(apiResult.value.ads);
    if (normalizedApi.length > 0) {
      applyAuthoritativeRemoteAds(normalizedApi);
      return;
    }
  }

  // Final fallback: Firebase RTDB SDK read
  try {
    const snap = await rtdbGet(rtdbRef(primaryRealtimeDb, 'ads'));
    const val = snap.val();
    const normalizedSdk = normalizeAdList(val);
    if (normalizedSdk.length > 0) {
      applyAuthoritativeRemoteAds(normalizedSdk);
    }
  } catch {}
}

function initSharedAdsListener() {
  if (isInitialized || typeof window === 'undefined') return;
  isInitialized = true;

  const handleLocalSync = () => {
    sharedAds = getLocalAds();
    notifySubscribers();
  };

  window.addEventListener(ADS_EVENT, handleLocalSync);
  window.addEventListener('storage', handleLocalSync);

  if (typeof BroadcastChannel !== 'undefined') {
    try {
      broadcastChannel = new BroadcastChannel(ADS_CHANNEL_NAME);
      broadcastChannel.onmessage = (event) => {
        if (Array.isArray(event.data)) {
          notifySubscribers(normalizeAdList(event.data));
        } else {
          fetchAdsFromAllSources().catch(() => {});
        }
      };
    } catch {}
  }

  // Real-time Firebase RTDB push subscription: instant updates when Admin modifies/adds/toggles ads
  try {
    onValue(rtdbRef(primaryRealtimeDb, 'ads'), (snap) => {
      const val = snap.val();
      if (val) {
        const normalized = normalizeAdList(val);
        if (normalized.length > 0) {
          applyAuthoritativeRemoteAds(normalized);
        }
      }
    });
  } catch {}

  // Immediate multi-source sync on boot
  fetchAdsFromAllSources().catch(() => {});

  // Re-sync when tab returns to focus or every 30s (fallback for mobile/static deployments)
  const handleFocusSync = () => {
    if (document.visibilityState === 'visible') {
      fetchAdsFromAllSources().catch(() => {});
    }
  };
  document.addEventListener('visibilitychange', handleFocusSync);
  window.addEventListener('focus', () => fetchAdsFromAllSources().catch(() => {}));
  window.setInterval(() => {
    fetchAdsFromAllSources().catch(() => {});
  }, 30000);
}

export function useAds() {
  const [ads, setAds] = useState<Ad[]>(sharedAds);

  useEffect(() => {
    initSharedAdsListener();

    const listener = (newAds: Ad[]) => {
      setAds(newAds);
    };

    subscribers.add(listener);
    // Sync initial state if singleton updated before mount
    setAds(sharedAds);

    return () => {
      subscribers.delete(listener);
    };
  }, []);

  // All active banner & in-feed ads, newest-updated first so newly added/edited banners display immediately
  const banners = useMemo(() => {
    return ads
      .filter(
        (a) =>
          (a.type === 'banner_468x60' || a.type === 'in_feed') &&
          a.status === 'on' &&
          Boolean(a.script?.trim())
      )
      .sort((a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0));
  }, [ads]);

  // Backward-compatible primary banner reference
  const banner = useMemo(() => {
    return banners[0] || ads.find((a) => a.type === 'banner_468x60' || a.type === 'in_feed');
  }, [banners, ads]);

  const socialBars = useMemo(() => {
    return ads.filter((a) => a.type === 'social_bar');
  }, [ads]);

  return { ads, banner, banners, socialBars, loading: false };
}

export async function saveAd(ad: Ad) {
  const current = getLocalAds();
  const idx = current.findIndex((a) => a.id === ad.id);
  const updatedAd: Ad = { ...ad, updatedAt: Date.now() };
  const next = [...current];
  if (idx >= 0) {
    next[idx] = updatedAd;
  } else {
    next.push(updatedAd);
  }

  notifySubscribers(next);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(ADS_EVENT));
    try {
      broadcastChannel?.postMessage(next);
    } catch {}
  }

  const adminToken = typeof window !== 'undefined' ? localStorage.getItem('mk-session-token') : null;

  await Promise.allSettled([
    dualRtdbSet(`ads/${ad.id}`, updatedAd),
    fetch('/api/ads', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(adminToken ? { Authorization: `Bearer ${adminToken}` } : {})
      },
      body: JSON.stringify(updatedAd)
    }),
    (() => {
      const { id, ...rest } = updatedAd;
      return dualFirestoreSetDoc('ads', id, { ...rest, updatedAt: updatedAd.updatedAt }, { merge: true });
    })()
  ]);
}

export async function removeAd(id: string) {
  const current = getLocalAds();
  const next = current.filter((a) => a.id !== id);

  notifySubscribers(next);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(ADS_EVENT));
    try {
      broadcastChannel?.postMessage(next);
    } catch {}
  }

  const adminToken = typeof window !== 'undefined' ? localStorage.getItem('mk-session-token') : null;

  await Promise.allSettled([
    dualRtdbRemove(`ads/${id}`),
    fetch(`/api/ads/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: {
        ...(adminToken ? { Authorization: `Bearer ${adminToken}` } : {})
      }
    }),
    dualFirestoreDeleteDoc('ads', id)
  ]);
}
