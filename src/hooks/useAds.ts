import { useEffect, useState } from 'react';
import { collection, doc, onSnapshot, setDoc, deleteDoc } from 'firebase/firestore';
import { ref as rtdbRef, onValue as rtdbOnValue, set as rtdbSet, remove as rtdbRemove } from 'firebase/database';
import { db, realtimeDb } from '../lib/firebase';
import { DEFAULT_ADS } from '../data/defaultAds';
import type { Ad } from '../types';

const LOCAL_ADS_KEY = 'mk-local-ads';
const ADS_EVENT = 'marketify-ads-updated';

function emitAdsUpdated() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(ADS_EVENT));
  }
}

function getLocalAds(): Ad[] {
  try {
    const raw = localStorage.getItem(LOCAL_ADS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}
  return DEFAULT_ADS;
}

function saveLocalAds(list: Ad[]) {
  try {
    localStorage.setItem(LOCAL_ADS_KEY, JSON.stringify(list));
  } catch {}
}

function mergeWithDefaults(remote: Ad[]): Ad[] {
  const local = getLocalAds();
  const mergedMap = new Map<string, Ad>();

  // 1. Initialize with defaults
  DEFAULT_ADS.forEach((d) => mergedMap.set(d.id, d));

  // 2. Merge local items
  local.forEach((l) => mergedMap.set(l.id, l));

  // 3. Merge remote items only if they are newer than what is in local, or not present in local
  remote.forEach((r) => {
    const existing = mergedMap.get(r.id);
    if (!existing || (r.updatedAt || 0) >= (existing.updatedAt || 0)) {
      mergedMap.set(r.id, r);
    }
  });

  return Array.from(mergedMap.values());
}

export function useAds() {
  const [ads, setAds] = useState<Ad[]>(() => getLocalAds());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const handleLocalSync = () => {
      setAds(getLocalAds());
    };

    window.addEventListener(ADS_EVENT, handleLocalSync);
    window.addEventListener('storage', handleLocalSync);

    // 1. Fetch from server API
    const fetchServerAds = async () => {
      try {
        const res = await fetch('/api/ads');
        if (res.ok) {
          const data = await res.json();
          if (data.success && Array.isArray(data.ads) && isMounted) {
            const serverAds: Ad[] = data.ads;
            const merged = mergeWithDefaults(serverAds);
            setAds(merged);
            saveLocalAds(merged);
          }
        }
      } catch (e) {
        console.warn('Failed to fetch /api/ads:', e);
      }
    };

    fetchServerAds();
    const pollInterval = setInterval(fetchServerAds, 4000);

    // 2. Realtime Database listener
    let rtdbUnsub = () => {};
    try {
      const aRef = rtdbRef(realtimeDb, 'ads');
      rtdbUnsub = rtdbOnValue(aRef, (snap) => {
        if (!isMounted) return;
        const val = snap.val();
        if (val) {
          let remote: Ad[] = [];
          if (Array.isArray(val)) {
            remote = val.filter(Boolean);
          } else if (typeof val === 'object') {
            remote = Object.entries(val).map(([id, item]) => ({ id, ...(item as Omit<Ad, 'id'>) }));
          }
          if (remote.length > 0) {
            const merged = mergeWithDefaults(remote);
            setAds(merged);
            saveLocalAds(merged);
          }
        }
      });
    } catch {}

    // 3. Parallel Firestore listener
    let firestoreUnsub = () => {};
    try {
      firestoreUnsub = onSnapshot(
        collection(db, 'ads'),
        (snap) => {
          if (!snap.empty && isMounted) {
            const remote = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Ad, 'id'>) }));
            const merged = mergeWithDefaults(remote);
            setAds(merged);
            saveLocalAds(merged);
          }
        },
        (err) => {
          console.warn('Firestore ads snapshot warning:', err);
        }
      );
    } catch (e) {
      console.warn('Firestore ads subscription failed:', e);
    }

    return () => {
      isMounted = false;
      clearInterval(pollInterval);
      rtdbUnsub();
      firestoreUnsub();
      window.removeEventListener(ADS_EVENT, handleLocalSync);
      window.removeEventListener('storage', handleLocalSync);
    };
  }, []);

  const banner = ads.find((a) => a.type === 'banner_468x60');
  const socialBars = ads.filter((a) => a.type === 'social_bar');

  return { ads, banner, socialBars, loading };
}

export async function saveAd(ad: Ad) {
  const current = getLocalAds();
  const idx = current.findIndex((a) => a.id === ad.id);
  const updatedAd = { ...ad, updatedAt: Date.now() };
  let next = [...current];
  if (idx >= 0) {
    next[idx] = updatedAd;
  } else {
    next.push(updatedAd);
  }
  saveLocalAds(next);
  emitAdsUpdated();

  // 1. Save to Realtime Database in background
  try {
    const adRef = rtdbRef(realtimeDb, `ads/${ad.id}`);
    rtdbSet(adRef, updatedAd).catch(() => {});
  } catch {}

  // 2. Save to server API in background
  fetch('/api/ads', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updatedAd)
  }).catch(() => {});

  // 3. Firestore save in background
  try {
    const { id, ...rest } = updatedAd;
    setDoc(doc(db, 'ads', id), { ...rest, updatedAt: Date.now() }, { merge: true }).catch(() => {});
  } catch {}
}

export async function removeAd(id: string) {
  const current = getLocalAds();
  const next = current.filter((a) => a.id !== id);
  saveLocalAds(next);
  emitAdsUpdated();

  // 1. Realtime Database delete in background
  try {
    const adRef = rtdbRef(realtimeDb, `ads/${id}`);
    rtdbRemove(adRef).catch(() => {});
  } catch {}

  // 2. Server API delete in background
  fetch(`/api/ads/${encodeURIComponent(id)}`, { method: 'DELETE' }).catch(() => {});

  // 3. Firestore delete in background
  try {
    deleteDoc(doc(db, 'ads', id)).catch(() => {});
  } catch {}
}
