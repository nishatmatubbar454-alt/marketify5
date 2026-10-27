import { ref as rtdbRef, set as rtdbSet, onValue as rtdbOnValue } from 'firebase/database';
import { signInAnonymously } from 'firebase/auth';
import { userRealtimeDb, userAuth } from '../lib/firebase';

const SESSION_COOKIE_NAME = 'mk_usr_sid';
const LOCAL_HISTORY_KEY = 'mk-user-history';
const LOCAL_FAVORITES_KEY = 'mk-user-favorites';

function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp('(^|;\\s*)' + name + '=([^;]+)'));
  return match ? decodeURIComponent(match[2]) : null;
}

function setCookie(name: string, value: string, days = 365) {
  if (typeof document === 'undefined') return;
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`;
}

// Persistent session ID linked with browser cookie & local identifier
export function getUserSessionId(): string {
  let sid = getCookie(SESSION_COOKIE_NAME);
  if (!sid && typeof localStorage !== 'undefined') {
    try {
      sid = localStorage.getItem(SESSION_COOKIE_NAME);
    } catch {}
  }

  if (!sid) {
    sid = 'usr_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
  }

  setCookie(SESSION_COOKIE_NAME, sid);
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(SESSION_COOKIE_NAME, sid);
    } catch {}
  }

  return sid;
}

// Initialize in-memory cache from persistent storage so history NEVER disappears or becomes 0
function getStoredLocalArray(key: string): string[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.filter((id) => typeof id === 'string' && id.trim());
    }
  } catch {}
  return [];
}

let inMemoryFavorites: string[] = getStoredLocalArray(LOCAL_FAVORITES_KEY);
let inMemoryHistory: string[] = getStoredLocalArray(LOCAL_HISTORY_KEY);
let isUserSyncInitialized = false;

export function initUserOnlineSync() {
  if (isUserSyncInitialized || typeof window === 'undefined') return;
  isUserSyncInitialized = true;

  // Background anonymous auth sign-in on user Firebase
  try {
    signInAnonymously(userAuth).catch(() => {});
  } catch {}

  const sid = getUserSessionId();
  const userNodeRef = rtdbRef(userRealtimeDb, `users/${sid}`);

  try {
    rtdbOnValue(userNodeRef, (snapshot) => {
      const data = snapshot.val();
      if (data && typeof data === 'object') {
        let remoteFavs: string[] = [];
        if (Array.isArray(data.favorites)) {
          remoteFavs = data.favorites.filter(Boolean);
        } else if (data.favorites && typeof data.favorites === 'object') {
          remoteFavs = Object.keys(data.favorites);
        }

        let remoteHist: string[] = [];
        if (Array.isArray(data.history)) {
          remoteHist = data.history.filter(Boolean);
        } else if (data.history && typeof data.history === 'object') {
          remoteHist = Object.keys(data.history);
        }

        // Merge with local state so newly watched videos are never lost
        if (remoteFavs.length > 0) {
          const mergedFavs = Array.from(new Set([...inMemoryFavorites, ...remoteFavs]));
          inMemoryFavorites = mergedFavs;
          try {
            localStorage.setItem(LOCAL_FAVORITES_KEY, JSON.stringify(mergedFavs));
          } catch {}
          window.dispatchEvent(new CustomEvent('mk-favorites-updated'));
        }

        if (remoteHist.length > 0) {
          const mergedHist = Array.from(new Set([...inMemoryHistory, ...remoteHist])).slice(0, 100);
          inMemoryHistory = mergedHist;
          try {
            localStorage.setItem(LOCAL_HISTORY_KEY, JSON.stringify(mergedHist));
          } catch {}
          window.dispatchEvent(new CustomEvent('mk-history-updated'));
        }
      }
    });
  } catch {}
}

export function getFavorites(): string[] {
  if (typeof window !== 'undefined' && !isUserSyncInitialized) {
    initUserOnlineSync();
  }
  if (inMemoryFavorites.length === 0) {
    inMemoryFavorites = getStoredLocalArray(LOCAL_FAVORITES_KEY);
  }
  return inMemoryFavorites;
}

export function toggleFavorite(id: string): boolean {
  if (!id) return false;
  if (!isUserSyncInitialized) initUserOnlineSync();

  const idx = inMemoryFavorites.indexOf(id);
  const isAdded = idx < 0;
  if (isAdded) {
    inMemoryFavorites = [id, ...inMemoryFavorites];
  } else {
    inMemoryFavorites = inMemoryFavorites.filter((item) => item !== id);
  }

  // Save to persistent backup immediately
  try {
    localStorage.setItem(LOCAL_FAVORITES_KEY, JSON.stringify(inMemoryFavorites));
  } catch {}

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('mk-favorites-updated'));
  }

  // Purely online sync to second Firebase database
  try {
    const sid = getUserSessionId();
    const favRef = rtdbRef(userRealtimeDb, `users/${sid}/favorites`);
    rtdbSet(favRef, inMemoryFavorites).catch(() => {});
  } catch {}

  return isAdded;
}

export function getHistory(): string[] {
  if (typeof window !== 'undefined' && !isUserSyncInitialized) {
    initUserOnlineSync();
  }
  if (inMemoryHistory.length === 0) {
    inMemoryHistory = getStoredLocalArray(LOCAL_HISTORY_KEY);
  }
  return inMemoryHistory;
}

export function addHistory(id: string) {
  if (!id) return;
  if (!isUserSyncInitialized) initUserOnlineSync();

  // Prepend current watched video and keep up to 100 entries
  inMemoryHistory = [id, ...inMemoryHistory.filter((item) => item !== id)].slice(0, 100);

  // Save immediately to persistent backup so history never resets to 0
  try {
    localStorage.setItem(LOCAL_HISTORY_KEY, JSON.stringify(inMemoryHistory));
  } catch {}

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('mk-history-updated', { detail: { id } }));
  }

  // Sync to online Firebase database
  try {
    const sid = getUserSessionId();
    const histRef = rtdbRef(userRealtimeDb, `users/${sid}/history`);
    rtdbSet(histRef, inMemoryHistory).catch(() => {});
  } catch {}
}

export function getTelegramLink(): string {
  return localStorage.getItem('mk-telegram-link') || 'https://t.me/telegram';
}

export function setTelegramLink(url: string) {
  localStorage.setItem('mk-telegram-link', url);
}

export function getContactLink(): string {
  return localStorage.getItem('mk-contact-link') || 'https://t.me/contact';
}

export function setContactLink(url: string) {
  localStorage.setItem('mk-contact-link', url);
}

export function isDirectLink(url: string): boolean {
  const trimmed = (url || '').trim().toLowerCase();
  if (!trimmed) return false;
  if (
    trimmed.startsWith('<iframe') ||
    trimmed.includes('youtube.com') ||
    trimmed.includes('youtu.be') ||
    trimmed.includes('vimeo.com') ||
    trimmed.includes('dailymotion.com') ||
    trimmed.includes('facebook.com') ||
    trimmed.includes('drive.google.com')
  ) {
    return false;
  }
  const videoExtensions = ['.mp4', '.webm', '.ogg', '.mov', '.m3u8', '.mkv', '.avi', '.flv'];
  return videoExtensions.some((ext) => trimmed.split('?')[0].endsWith(ext));
}

export function getOptimizedThumbnail(url?: string): string {
  if (!url) return '';
  const trimmed = url.trim();
  // Downscale giant maxres YouTube thumbnails (400KB-800KB) to hqdefault (15KB-25KB)
  // Saves over 95% internet data while looking crisp on mobile
  if (trimmed.includes('i.ytimg.com') || trimmed.includes('img.youtube.com')) {
    return trimmed.replace(/\/maxresdefault(\.jpg|\.webp)?/i, '/hqdefault$1');
  }
  return trimmed;
}
