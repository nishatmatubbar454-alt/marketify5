import { initializeApp, getApps } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getStorage } from 'firebase/storage';
import { getDatabase } from 'firebase/database';
import { getAnalytics, isSupported, type Analytics } from 'firebase/analytics';

const DEFAULT_FIREBASE_CONFIG = {
  apiKey: "AIzaSyDaDfql5hzf8CCFAOVNX0c8xeyfsVJWYQg",
  authDomain: "himrw-fae65.firebaseapp.com",
  databaseURL: "https://himrw-fae65-default-rtdb.firebaseio.com",
  projectId: "himrw-fae65",
  storageBucket: "himrw-fae65.firebasestorage.app",
  messagingSenderId: "697331272278",
  appId: "1:697331272278:web:fb1ed4bc02d4397a78c9f7",
  measurementId: "G-L5EF52FPXW"
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
  return DEFAULT_FIREBASE_CONFIG;
}

const firebaseConfig = getFirebaseConfig();

export const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);
export const realtimeDb = getDatabase(app);

export let analytics: Analytics | null = null;
if (typeof window !== 'undefined' && firebaseConfig.measurementId) {
  isSupported().then((supported) => {
    if (supported) {
      try {
        analytics = getAnalytics(app);
      } catch {}
    }
  }).catch(() => {});
}

// Second Firebase database for purely online user history & favorites
export const USER_FIREBASE_CONFIG = {
  apiKey: "AIzaSyCaw_PmFlltYJHIiZEYWnt47ry1NxTZp9U",
  authDomain: "markitify-6c51e.firebaseapp.com",
  databaseURL: "https://markitify-6c51e-default-rtdb.firebaseio.com",
  projectId: "markitify-6c51e",
  storageBucket: "markitify-6c51e.firebasestorage.app",
  messagingSenderId: "169887153511",
  appId: "1:169887153511:web:0cc3f8b98ea2d2666c03c2"
};

export const userApp =
  getApps().find((a) => a.name === 'userApp') || initializeApp(USER_FIREBASE_CONFIG, 'userApp');
export const userRealtimeDb = getDatabase(userApp);
export const userAuth = getAuth(userApp);
export const userDb = getFirestore(userApp);

