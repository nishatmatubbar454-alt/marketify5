import { ref as rtdbRef, set as rtdbSet, onValue as rtdbOnValue } from 'firebase/database';
import { signInAnonymously } from 'firebase/auth';
import { userRealtimeDb, userAuth } from '../lib/firebase';

const SESSION_COOKIE_NAME = 'mk_usr_sid';

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

export function getUserSessionId(): string {
  let sid = getCookie(SESSION_COOKIE_NAME);
  if (!sid) {
    sid = 'usr_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
    setCookie(SESSION_COOKIE_NAME, sid);
  }
  return sid;
}

// In-memory collections purely synced with the second Firebase (zero localStorage disk bloat)
let inMemoryFavorites: string[] = [];
let inMemoryHistory: string[] = [];
let isUserSyncInitialized = false;

// Remove any old local storage bloat so no MB is stored locally
if (typeof window !== 'undefined') {
  try {
    localStorage.removeItem('mk-favorites');
    localStorage.removeItem('mk-history');
    localStorage.removeItem('mk-local-videos');
  } catch {}
}

export function initUserOnlineSync() {
  if (isUserSyncInitialized || typeof window === 'undefined') return;
  isUserSyncInitialized = true;

  // Background anonymous auth sign-in on the second Firebase
  try {
    signInAnonymously(userAuth).catch(() => {});
  } catch {}

  const sid = getUserSessionId();
  const userNodeRef = rtdbRef(userRealtimeDb, `users/${sid}`);

  try {
    rtdbOnValue(userNodeRef, (snapshot) => {
      const data = snapshot.val();
      if (data && typeof data === 'object') {
        if (Array.isArray(data.favorites)) {
          inMemoryFavorites = data.favorites.filter(Boolean);
        } else if (data.favorites && typeof data.favorites === 'object') {
          inMemoryFavorites = Object.keys(data.favorites);
        }

        if (Array.isArray(data.history)) {
          inMemoryHistory = data.history.filter(Boolean);
        } else if (data.history && typeof data.history === 'object') {
          inMemoryHistory = Object.keys(data.history);
        }

        window.dispatchEvent(new CustomEvent('mk-favorites-updated'));
        window.dispatchEvent(new CustomEvent('mk-history-updated'));
      }
    });
  } catch {}
}

export function getFavorites(): string[] {
  if (typeof window !== 'undefined' && !isUserSyncInitialized) {
    initUserOnlineSync();
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
  return inMemoryHistory;
}

export function addHistory(id: string) {
  if (!id) return;
  if (!isUserSyncInitialized) initUserOnlineSync();

  inMemoryHistory = [id, ...inMemoryHistory.filter((item) => item !== id)].slice(0, 100);

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('mk-history-updated', { detail: { id } }));
  }

  // Purely online sync to second Firebase database
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
