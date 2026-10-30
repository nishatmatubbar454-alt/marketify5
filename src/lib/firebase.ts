import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getStorage } from 'firebase/storage';
import { getDatabase, ref as rtdbRef, set as rtdbSet, remove as rtdbRemove } from 'firebase/database';
import { getAnalytics, isSupported, type Analytics } from 'firebase/analytics';

// Firebase Project 1: Primary (himrw-fae65)
export const PRIMARY_FIREBASE_CONFIG = {
  apiKey: "AIzaSyDaDfql5hzf8CCFAOVNX0c8xeyfsVJWYQg",
  authDomain: "himrw-fae65.firebaseapp.com",
  databaseURL: "https://himrw-fae65-default-rtdb.firebaseio.com",
  projectId: "himrw-fae65",
  storageBucket: "himrw-fae65.firebasestorage.app",
  messagingSenderId: "697331272278",
  appId: "1:697331272278:web:fb1ed4bc02d4397a78c9f7",
  measurementId: "G-L5EF52FPXW"
};

// Firebase Project 2: Secondary / High-Traffic Load Balancer (markitify-6c51e)
export const SECONDARY_FIREBASE_CONFIG = {
  apiKey: "AIzaSyCaw_PmFlltYJHIiZEYWnt47ry1NxTZp9U",
  authDomain: "markitify-6c51e.firebaseapp.com",
  databaseURL: "https://markitify-6c51e-default-rtdb.firebaseio.com",
  projectId: "markitify-6c51e",
  storageBucket: "markitify-6c51e.firebasestorage.app",
  messagingSenderId: "169887153511",
  appId: "1:169887153511:web:0cc3f8b98ea2d2666c03c2"
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

// Initialize Primary Firebase (himrw-fae65)
export const primaryApp =
  getApps().find((a) => a.name === '[DEFAULT]') || initializeApp(activePrimaryConfig);
export const primaryDb = getFirestore(primaryApp);
export const primaryAuth = getAuth(primaryApp);
export const primaryStorage = getStorage(primaryApp);
export const primaryRealtimeDb = getDatabase(primaryApp);

// Initialize Secondary Firebase (markitify-6c51e)
export const secondaryApp =
  getApps().find((a) => a.name === 'secondaryApp') ||
  initializeApp(SECONDARY_FIREBASE_CONFIG, 'secondaryApp');
export const secondaryDb = getFirestore(secondaryApp);
export const secondaryAuth = getAuth(secondaryApp);
export const secondaryStorage = getStorage(secondaryApp);
export const secondaryRealtimeDb = getDatabase(secondaryApp);

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
  'https://himrw-fae65-default-rtdb.firebaseio.com',
  'https://markitify-6c51e-default-rtdb.firebaseio.com'
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
 * Load-balanced HTTP REST fetch across both Firebase projects with instant failover.
 * Distributes 50% traffic to himrw-fae65 and 50% to markitify-6c51e.
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
    // Failover seamlessly to secondary Firebase
    return fetch(url2, options);
  }
}

/**
 * Dual RTDB Write: writes simultaneously to both Firebase Realtime Databases
 */
export async function dualRtdbSet(path: string, value: any): Promise<void> {
  await Promise.allSettled([
    rtdbSet(rtdbRef(primaryRealtimeDb, path), value),
    rtdbSet(rtdbRef(secondaryRealtimeDb, path), value)
  ]);
}

/**
 * Dual RTDB Remove: removes simultaneously from both Firebase Realtime Databases
 */
export async function dualRtdbRemove(path: string): Promise<void> {
  await Promise.allSettled([
    rtdbRemove(rtdbRef(primaryRealtimeDb, path)),
    rtdbRemove(rtdbRef(secondaryRealtimeDb, path))
  ]);
}

/**
 * Dual Firestore Write: writes to both Firestore instances
 */
export async function dualFirestoreSetDoc(
  collectionName: string,
  docId: string,
  data: any,
  options: any = { merge: true }
): Promise<void> {
  await Promise.allSettled([
    setDoc(doc(primaryDb, collectionName, docId), data, options),
    setDoc(doc(secondaryDb, collectionName, docId), data, options)
  ]);
}

/**
 * Dual Firestore Delete: deletes from both Firestore instances
 */
export async function dualFirestoreDeleteDoc(
  collectionName: string,
  docId: string
): Promise<void> {
  await Promise.allSettled([
    deleteDoc(doc(primaryDb, collectionName, docId)),
    deleteDoc(doc(secondaryDb, collectionName, docId))
  ]);
}
