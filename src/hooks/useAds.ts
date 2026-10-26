import { useEffect, useState } from 'react';
import { collection, doc, onSnapshot, setDoc, deleteDoc } from 'firebase/firestore';
import { ref as rtdbRef, onValue as rtdbOnValue, set as rtdbSet, remove as rtdbRemove } from 'firebase/database';
import { db, realtimeDb } from '../lib/firebase';
import { DEFAULT_ADS } from '../data/defaultAds';
import type { Ad } from '../types';

const LOCAL_ADS_KEY = 'mk-local-ads';
const ADS_EVENT = 'marketify-ads-updated';

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

  DEFAULT_ADS.forEach((d) => mergedMap.set(d.id, d));
  local.forEach((l) => mergedMap.set(l.id, l));
  remote.forEach((r) => {
    const existing = mergedMap.get(r.id);
    if (!existing || (r.updatedAt || 0) >= (existing.updatedAt || 0)) {
      mergedMap.set(r.id, r);
    }
  });

  return Array.from(mergedMap.values());
}

// Global in-memory singleton to avoid redundant listeners and CPU overhead
let sharedAds: Ad[] = getLocalAds();
const subscribers = new Set<(ads: Ad[]) => void>();
let isInitialized = false;

function notifySubscribers() {
  subscribers.forEach((fn) => fn(sharedAds));
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

  // 1. Instant server fetch
  fetch('/api/ads')
    .then((res) => (res.ok ? res.json() : null))
    .then((data) => {
      if (data && data.success && Array.isArray(data.ads)) {
        sharedAds = mergeWithDefaults(data.ads);
        saveLocalAds(sharedAds);
        notifySubscribers();
      }
    })
    .catch(() => {});

}

export function useAds() {
  const [ads, setAds] = useState<Ad[]>(sharedAds);

  useEffect(() => {
    initSharedAdsListener();

    const listener = (newAds: Ad[]) => {
      setAds(newAds);
    };

    subscribers.add(listener);
    return () => {
      subscribers.delete(listener);
    };
  }, []);

  const banner = ads.find((a) => a.type === 'banner_468x60');
  const socialBars = ads.filter((a) => a.type === 'social_bar');

  return { ads, banner, socialBars, loading: false };
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
  sharedAds = next;
  saveLocalAds(next);
  notifySubscribers();
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(ADS_EVENT));
  }

  // Realtime Database save
  try {
    const adRef = rtdbRef(realtimeDb, `ads/${ad.id}`);
    rtdbSet(adRef, updatedAd).catch(() => {});
  } catch {}

  // Server API save
  fetch('/api/ads', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updatedAd)
  }).catch(() => {});

  // Firestore save
  try {
    const { id, ...rest } = updatedAd;
    setDoc(doc(db, 'ads', id), { ...rest, updatedAt: Date.now() }, { merge: true }).catch(() => {});
  } catch {}
}

export async function removeAd(id: string) {
  const current = getLocalAds();
  const next = current.filter((a) => a.id !== id);
  sharedAds = next;
  saveLocalAds(next);
  notifySubscribers();
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(ADS_EVENT));
  }

  try {
    const adRef = rtdbRef(realtimeDb, `ads/${id}`);
    rtdbRemove(adRef).catch(() => {});
  } catch {}

  fetch(`/api/ads/${encodeURIComponent(id)}`, { method: 'DELETE' }).catch(() => {});

  try {
    deleteDoc(doc(db, 'ads', id)).catch(() => {});
  } catch {}
}
