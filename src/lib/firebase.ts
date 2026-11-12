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
 * Load-balanced HTTP REST fetch across Firebase projects with instant failover.
 */
export async function loadBalancedFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const [url1, url2] = getBalancedEndpoints(path);

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3500);
    const res = await fetch(url1, { ...options, signal: controller.signal });
    clearTimeout(timer);

    if (res.ok) {
      return res;
    }
    // Failover if server error or rate-limited
    if (res.status >= 429) {
      throw new Error(`Primary status ${res.status}`);
    }
    return res;
  } catch {
    // Failover seamlessly to secondary Firebase or backup
    try {
      return await fetch(url2, options);
    } catch {
      const cleanPath = path.startsWith('/') ? path : `/${path}`;
      return fetch(`${RTDB_ENDPOINTS[2]}${cleanPath}`, options);
    }
  }
}

/**
 * Multi RTDB Write: writes simultaneously to Primary, Secondary, and Dedicated Backup RTDB
 */
export async function dualRtdbSet(path: string, value: any): Promise<void> {
  await Promise.allSettled([
    rtdbSet(rtdbRef(primaryRealtimeDb, path), value),
    rtdbSet(rtdbRef(secondaryRealtimeDb, path), value),
    rtdbSet(rtdbRef(backupRealtimeDb, path), value)
  ]);
}

/**
 * Multi RTDB Remove: removes simultaneously from Primary, Secondary, and Backup RTDB
 */
export async function dualRtdbRemove(path: string): Promise<void> {
  await Promise.allSettled([
    rtdbRemove(rtdbRef(primaryRealtimeDb, path)),
    rtdbRemove(rtdbRef(secondaryRealtimeDb, path)),
    rtdbRemove(rtdbRef(backupRealtimeDb, path))
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
