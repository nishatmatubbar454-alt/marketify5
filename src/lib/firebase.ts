import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getStorage } from 'firebase/storage';
import { getDatabase, ref as rtdbRef, set as rtdbSet, remove as rtdbRemove } from 'firebase/database';
import { getAnalytics, isSupported, type Analytics } from 'firebase/analytics';

// Firebase Project 1: Primary (maka-bfd59)
export const PRIMARY_FIREBASE_CONFIG = {
  apiKey: "AIzaSyCzIdArW-CMPtDomdsprqW39RG7QNHs1RM",
  authDomain: "maka-bfd59.firebaseapp.com",
  databaseURL: "https://maka-bfd59-default-rtdb.firebaseio.com",
  projectId: "maka-bfd59",
  storageBucket: "maka-bfd59.firebasestorage.app",
  messagingSenderId: "1027339563782",
  appId: "1:1027339563782:web:d6b6242fbb3fe65c3e2487",
  measurementId: "G-F7YF8XDW04"
};

// Firebase Project 2: Secondary / Backup Load Balancer (himrw-fae65)
export const SECONDARY_FIREBASE_CONFIG = {
  apiKey: "AIzaSyDaDfql5hzf8CCFAOVNX0c8xeyfsVJWYQg",
  authDomain: "himrw-fae65.firebaseapp.com",
  databaseURL: "https://himrw-fae65-default-rtdb.firebaseio.com",
  projectId: "himrw-fae65",
  storageBucket: "himrw-fae65.firebasestorage.app",
  messagingSenderId: "697331272278",
  appId: "1:697331272278:web:fb1ed4bc02d4397a78c9f7",
  measurementId: "G-L5EF52FPXW"
};

// Firebase Project 3: Dedicated Safe Cloud Backup (backup-markitify)
export const BACKUP_FIREBASE_CONFIG = {
  apiKey: "AIzaSyDgxbqtjVToaR7PB5z33t-608LgWPRv8Nc",
  authDomain: "backup-markitify.firebaseapp.com",
  databaseURL: "https://backup-markitify-default-rtdb.firebaseio.com",
  projectId: "backup-markitify",
  storageBucket: "backup-markitify.firebasestorage.app",
  messagingSenderId: "167426337568",
  appId: "1:167426337568:web:5fe17e4eed6cb9fcbac545"
};

function getFirebaseConfig() {
  try {
    const saved = localStorage.getItem('mk-firebase-config');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (!parsed.databaseURL && parsed.projectId) {
        parsed.databaseURL = `https://${parsed.projectId}-default-rtdb.firebaseio.com`;
      }
      return parsed;
    }
  } catch {}
  return PRIMARY_FIREBASE_CONFIG;
}

const activePrimaryConfig = getFirebaseConfig();

// Initialize Primary Firebase: maka-bfd59
export const primaryApp =
  getApps().find((a) => a.name === '[DEFAULT]') || initializeApp(activePrimaryConfig);
export const primaryDb = getFirestore(primaryApp);
export const primaryAuth = getAuth(primaryApp);
export const primaryStorage = getStorage(primaryApp);
export const primaryRealtimeDb = getDatabase(primaryApp);

// Initialize Secondary Firebase: himrw-fae65
export const secondaryApp =
  getApps().find((a) => a.name === 'secondaryApp') ||
  initializeApp(SECONDARY_FIREBASE_CONFIG, 'secondaryApp');
export const secondaryDb = getFirestore(secondaryApp);
export const secondaryAuth = getAuth(secondaryApp);
export const secondaryStorage = getStorage(secondaryApp);
export const secondaryRealtimeDb = getDatabase(secondaryApp);

// Initialize Backup Firebase: backup-markitify (Dedicated Safe Storage)
export const backupApp =
  getApps().find((a) => a.name === 'backupApp') ||
  initializeApp(BACKUP_FIREBASE_CONFIG, 'backupApp');
export const backupDb = getFirestore(backupApp);
export const backupAuth = getAuth(backupApp);
export const backupStorage = getStorage(backupApp);
export const backupRealtimeDb = getDatabase(backupApp);

// Default exports for backward compatibility
export const app = primaryApp;
export const db = primaryDb;
export const auth = primaryAuth;
export const storage = primaryStorage;
export const realtimeDb = primaryRealtimeDb;

export const userApp = secondaryApp;
export const userRealtimeDb = secondaryRealtimeDb;
export const userAuth = secondaryAuth;
export const userDb = secondaryDb;
export const USER_FIREBASE_CONFIG = SECONDARY_FIREBASE_CONFIG;

// Analytics
export let analytics: Analytics | null = null;
if (typeof window !== 'undefined' && activePrimaryConfig.measurementId) {
  isSupported().then((supported) => {
    if (supported) {
      try {
        analytics = getAnalytics(app);
      } catch {}
    }
  }).catch(() => {});
}

// ==========================================
// DUAL FIREBASE LOAD BALANCER & SYNC UTILITIES
// ==========================================

export const RTDB_ENDPOINTS = [
  'https://maka-bfd59-default-rtdb.firebaseio.com',
  'https://himrw-fae65-default-rtdb.firebaseio.com',
  'https://backup-markitify-default-rtdb.firebaseio.com'
];

let roundRobinCounter = Math.floor(Math.random() * 2);

/**
 * Returns balanced primary and fallback RTDB URLs (50/50 split)
 */
export function getBalancedEndpoints(path: string = ''): [string, string] {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  const pickFirst = (roundRobinCounter++) % 2 === 0;
  const first = RTDB_ENDPOINTS[pickFirst ? 0 : 1];
  const second = RTDB_ENDPOINTS[pickFirst ? 1 : 0];
  return [`${first}${cleanPath}`, `${second}${cleanPath}`];
}

/**
 * Fetch JSON from a specific RTDB endpoint with configurable timeout
 */
export async function fetchRtdbJson<T = any>(
  baseEndpoint: string,
  path: string,
  timeoutMs = 15000
): Promise<T | null> {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${baseEndpoint}${cleanPath}`, {
      cache: 'no-store',
      signal: controller.signal
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Fetch a single video by ID across ALL 3 Firebase RTDBs, returning the first complete valid record.
 */
export async function fetchVideoByIdAcrossFirebases(id: string): Promise<Record<string, any> | null> {
  const path = `/videos/${encodeURIComponent(id)}.json`;
  const results = await Promise.allSettled(
    RTDB_ENDPOINTS.map((endpoint) => fetchRtdbJson<Record<string, any>>(endpoint, path, 8000))
  );
  let best: Record<string, any> | null = null;
  for (const r of results) {
    if (r.status === 'fulfilled' && r.value && typeof r.value === 'object') {
      const v = r.value;
      const hasEmbed = typeof v.embedUrl === 'string' && v.embedUrl.trim().length > 0;
      const hasWeb =
        (typeof v.websiteUrl === 'string' && v.websiteUrl.trim().length > 0) ||
        (typeof v.targetUrl === 'string' && v.targetUrl.trim().length > 0);
      if (hasEmbed || hasWeb) {
        if (!best || (v.updatedAt || 0) > (best.updatedAt || 0)) {
          best = v;
        }
      }
    }
  }
  return best;
}

/**
 * Load-balanced HTTP REST fetch across Firebase projects with generous timeout & instant failover.
 */
export async function loadBalancedFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const [url1, url2] = getBalancedEndpoints(path);
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  const url3 = `${RTDB_ENDPOINTS[2]}${cleanPath}`;
  // Full /videos.json (~20MB) needs generous timeout so mobile connections never abort prematurely
  const isFullVideosDump = cleanPath === '/videos.json';
  const timeoutMs = isFullVideosDump ? 45000 : 10000;

  for (const url of [url1, url2, url3]) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(timer);
      if (res.ok) {
        return res;
      }
    } catch {
      clearTimeout(timer);
    }
  }
  return fetch(url1, options);
}

/**
 * Multi RTDB Write: writes simultaneously via direct REST PUT + SDK to Primary, Secondary, and Dedicated Backup RTDB
 */
export async function dualRtdbSet(path: string, value: any): Promise<void> {
  const cleanPath = path.replace(/^\/+/, '');
  const jsonBody = JSON.stringify(value === undefined ? null : value);

  const restWrites = RTDB_ENDPOINTS.map(async (endpoint) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    try {
      const res = await fetch(`${endpoint}/${cleanPath}.json`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: jsonBody,
        signal: controller.signal
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    } finally {
      clearTimeout(timer);
    }
  });

  const sdkWrites = [
    rtdbSet(rtdbRef(primaryRealtimeDb, cleanPath), value),
    rtdbSet(rtdbRef(secondaryRealtimeDb, cleanPath), value),
    rtdbSet(rtdbRef(backupRealtimeDb, cleanPath), value)
  ];

  await Promise.allSettled([...restWrites, ...sdkWrites]);
}

/**
 * Multi RTDB Remove: removes simultaneously from Primary, Secondary, and Backup RTDB
 */
export async function dualRtdbRemove(path: string): Promise<void> {
  const cleanPath = path.replace(/^\/+/, '');

  const restDeletes = RTDB_ENDPOINTS.map(async (endpoint) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    try {
      await fetch(`${endpoint}/${cleanPath}.json`, {
        method: 'DELETE',
        signal: controller.signal
      });
    } finally {
      clearTimeout(timer);
    }
  });

  await Promise.allSettled([
    ...restDeletes,
    rtdbRemove(rtdbRef(primaryRealtimeDb, cleanPath)),
    rtdbRemove(rtdbRef(secondaryRealtimeDb, cleanPath)),
    rtdbRemove(rtdbRef(backupRealtimeDb, cleanPath))
  ]);
}

/**
 * Multi Firestore Write: writes to Primary, Secondary, and Dedicated Backup Firestore
 */
export async function dualFirestoreSetDoc(
  collectionName: string,
  docId: string,
  data: any,
  options: any = { merge: true }
): Promise<void> {
  await Promise.allSettled([
    setDoc(doc(primaryDb, collectionName, docId), data, options),
    setDoc(doc(secondaryDb, collectionName, docId), data, options),
    setDoc(doc(backupDb, collectionName, docId), data, options)
  ]);
}

/**
 * Multi Firestore Delete: deletes from Primary, Secondary, and Dedicated Backup Firestore
 */
export async function dualFirestoreDeleteDoc(
  collectionName: string,
  docId: string
): Promise<void> {
  await Promise.allSettled([
    deleteDoc(doc(primaryDb, collectionName, docId)),
    deleteDoc(doc(secondaryDb, collectionName, docId)),
    deleteDoc(doc(backupDb, collectionName, docId))
  ]);
}
