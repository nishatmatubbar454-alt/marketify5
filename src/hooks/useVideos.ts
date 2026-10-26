import { useEffect, useState } from 'react';
import {
  collection,
  deleteDoc,
  doc,
  increment,
  setDoc
} from 'firebase/firestore';
import { ref as rtdbRef, get as rtdbGet, onValue as rtdbOnValue, set as rtdbSet, remove as rtdbRemove } from 'firebase/database';
import { db, realtimeDb } from '../lib/firebase';
import type { Video, VideoStatus } from '../types';
import { INITIAL_VIDEOS } from '../data/initialVideos';

const LOCAL_VIDEOS_KEY = 'mk-local-videos';
const VIDEOS_EVENT = 'marketify-videos-updated';

function emitVideosUpdated() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(VIDEOS_EVENT));
  }
}

export function isValidVideo(v: any): boolean {
  if (!v || typeof v !== 'object') return false;
  if (typeof v.id !== 'string' || !v.id.trim()) return false;
  const hasEmbed = typeof v.embedUrl === 'string' && v.embedUrl.trim().length > 0;
  const hasWebsite =
    (typeof v.websiteUrl === 'string' && v.websiteUrl.trim().length > 0) ||
    (typeof v.targetUrl === 'string' && v.targetUrl.trim().length > 0);
  return hasEmbed || hasWebsite;
}

let inMemoryVideosCache: Video[] | null = null;

// Wipe any previous localStorage video dump to save user disk space & MB
if (typeof window !== 'undefined') {
  try {
    localStorage.removeItem(LOCAL_VIDEOS_KEY);
  } catch {}
}

function getLocalVideos(): Video[] {
  if (inMemoryVideosCache && inMemoryVideosCache.length > 0) {
    return inMemoryVideosCache.filter(isValidVideo);
  }
  return INITIAL_VIDEOS;
}

function saveLocalVideos(list: Video[]) {
  const filtered = list.filter(isValidVideo);
  inMemoryVideosCache = filtered;
}

function mapVideo(id: string, data: Record<string, unknown>): Video | null {
  const embedUrl = (data.embedUrl as string) || '';
  const websiteUrl = (data.websiteUrl as string) || (data.targetUrl as string) || '';

  if (!embedUrl.trim() && !websiteUrl.trim()) {
    return null;
  }

  return {
    id,
    thumbnailUrl: (data.thumbnailUrl as string) || '',
    embedUrl: embedUrl.trim(),
    websiteUrl: websiteUrl.trim(),
    title: (data.title as string) || 'Untitled video',
    sourceName: (data.sourceName as string) || 'Marketify',
    duration: (data.duration as string) || '',
    status: (data.status as Video['status']) || 'active',
    views: typeof data.views === 'number' ? (data.views as number) : 0,
    likes: typeof data.likes === 'number' ? (data.likes as number) : 0,
    commentsCount: typeof data.commentsCount === 'number' ? (data.commentsCount as number) : 0,
    createdAt: (data.createdAt as number) || (data.updatedAt as number) || 0,
    updatedAt: (data.updatedAt as number) || (data.createdAt as number) || 0
  };
}

function areVideosEqual(a: Video[], b: Video[]): boolean {
  if (a.length !== b.length) return false;
  if (a.length === 0) return true;
  return a[0].id === b[0].id && a[0].updatedAt === b[0].updatedAt && a[a.length - 1].id === b[b.length - 1].id;
}

// Global in-memory singleton for instant 0ms access
let sharedVideos: Video[] = getLocalVideos();
const videoSubscribers = new Set<(videos: Video[]) => void>();
let isVideosInitialized = false;

function notifyVideoSubscribers() {
  videoSubscribers.forEach((fn) => fn(sharedVideos));
}

function initSharedVideosListener() {
  if (isVideosInitialized || typeof window === 'undefined') return;
  isVideosInitialized = true;

  const handleLocalSync = () => {
    const current = getLocalVideos();
    if (!areVideosEqual(sharedVideos, current)) {
      sharedVideos = current;
      notifyVideoSubscribers();
    }
  };

  window.addEventListener(VIDEOS_EVENT, handleLocalSync);
  window.addEventListener('storage', handleLocalSync);

  // Directly load from Firebase Realtime Database (works on Cloudflare Workers, static CDN, or Node)
  const loadVideosFromFirebase = async (): Promise<boolean> => {
    // 1. Direct REST fetch (fastest, universally accessible without SDK overhead)
    try {
      const res = await fetch('https://himrw-fae65-default-rtdb.firebaseio.com/videos.json');
      if (res.ok) {
        const val = await res.json();
        if (val && typeof val === 'object') {
          const remoteList: Video[] = Object.entries(val)
            .filter(([k, v]) => v && typeof v === 'object' && !/^\d+$/.test(k))
            .map(([k, v]) => mapVideo(k, v as Record<string, unknown>))
            .filter((v: Video | null): v is Video => v !== null && isValidVideo(v))
            .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

          if (remoteList.length > 0 && !areVideosEqual(sharedVideos, remoteList)) {
            sharedVideos = remoteList;
            saveLocalVideos(remoteList);
            notifyVideoSubscribers();
            return true;
          }
        }
      }
    } catch {}

    // 2. Fallback to Firebase SDK rtdbGet
    try {
      const snap = await rtdbGet(rtdbRef(realtimeDb, 'videos'));
      const val = snap.val();
      if (val && typeof val === 'object') {
        const remoteList: Video[] = Object.entries(val)
          .filter(([k, v]) => v && typeof v === 'object' && !/^\d+$/.test(k))
          .map(([k, v]) => mapVideo(k, v as Record<string, unknown>))
          .filter((v: Video | null): v is Video => v !== null && isValidVideo(v))
          .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

        if (remoteList.length > 0 && !areVideosEqual(sharedVideos, remoteList)) {
          sharedVideos = remoteList;
          saveLocalVideos(remoteList);
          notifyVideoSubscribers();
          return true;
        }
      }
    } catch {}

    return false;
  };

  // 1. First try fast local Express server API fetch
  fetch('/api/videos')
    .then((res) => (res.ok ? res.json() : null))
    .then((data) => {
      if (data && data.success && Array.isArray(data.videos) && data.videos.length > 0) {
        const serverVideos: Video[] = data.videos
          .map((v: any) => mapVideo(v.id, v))
          .filter((v: Video | null): v is Video => v !== null && isValidVideo(v));
        if (!areVideosEqual(sharedVideos, serverVideos)) {
          sharedVideos = serverVideos;
          saveLocalVideos(serverVideos);
          notifyVideoSubscribers();
        }
      } else {
        // Express not present or returned 404 (e.g. on Cloudflare Workers / Static hosting)
        loadVideosFromFirebase();
      }
    })
    .catch(() => {
      loadVideosFromFirebase();
    });

  // Always trigger direct Firebase load if in-memory list is empty
  if (sharedVideos.length === 0) {
    loadVideosFromFirebase();
  }

  // 2. Gentle background conditional refresh (uses HTTP 304, zero data if unchanged)
  let pollInterval: ReturnType<typeof setInterval> | null = null;
  const poll = () => {
    if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
      fetch('/api/videos', { cache: 'default' })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data && data.success && Array.isArray(data.videos) && data.videos.length > 0) {
            const serverVideos: Video[] = data.videos
              .map((v: any) => mapVideo(v.id, v))
              .filter((v: Video | null): v is Video => v !== null && isValidVideo(v));
            if (!areVideosEqual(sharedVideos, serverVideos)) {
              sharedVideos = serverVideos;
              saveLocalVideos(serverVideos);
              notifyVideoSubscribers();
            }
          } else {
            loadVideosFromFirebase();
          }
        })
        .catch(() => {
          loadVideosFromFirebase();
        });
    }
  };

  pollInterval = setInterval(poll, 60000);
  window.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      poll();
    }
  });
}

export function useVideos() {
  const [videos, setVideos] = useState<Video[]>(sharedVideos);
  const [loading, setLoading] = useState(() => sharedVideos.length === 0);

  useEffect(() => {
    initSharedVideosListener();

    if (sharedVideos.length > 0) {
      setLoading(false);
    }

    const listener = (newVideos: Video[]) => {
      setVideos(newVideos);
      if (newVideos.length > 0) {
        setLoading(false);
      }
    };

    videoSubscribers.add(listener);
    return () => {
      videoSubscribers.delete(listener);
    };
  }, []);

  return { videos, loading, error: null };
}

export async function saveVideo(
  id: string | null,
  payload: Partial<Video>
): Promise<string> {
  const now = Date.now();
  const targetId = id || `vid_${now}_${Math.random().toString(36).substring(2, 7)}`;

  const local = getLocalVideos();
  const existing = local.find((v) => v.id === targetId);
  const createdAt = payload.createdAt || existing?.createdAt || now;
  const initialLikes = payload.likes ?? (existing?.likes || 0);
  const initialViews = payload.views ?? (existing?.views || 0);

  const videoData: Video = {
    id: targetId,
    thumbnailUrl: payload.thumbnailUrl || '',
    embedUrl: (payload.embedUrl || '').trim(),
    websiteUrl: (payload.websiteUrl || '').trim(),
    title: payload.title || 'Untitled video',
    sourceName: payload.sourceName || 'Marketify',
    duration: payload.duration || '',
    status: (payload.status || 'active') as VideoStatus,
    views: initialViews,
    likes: initialLikes,
    commentsCount: payload.commentsCount ?? (existing?.commentsCount || 0),
    createdAt,
    updatedAt: now
  };

  // 1. Instant local update + event notification (0ms)
  const cachedList = getLocalVideos();
  const existingIdx = cachedList.findIndex((v) => v.id === targetId);
  let updatedList = [...cachedList];
  if (existingIdx >= 0) {
    updatedList[existingIdx] = { ...cachedList[existingIdx], ...videoData };
  } else {
    updatedList = [videoData, ...updatedList];
  }
  updatedList.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  sharedVideos = updatedList;
  saveLocalVideos(updatedList);
  notifyVideoSubscribers();
  emitVideosUpdated();

  // 2. Background sync to Realtime DB & server API
  try {
    const videoRef = rtdbRef(realtimeDb, `videos/${targetId}`);
    rtdbSet(videoRef, videoData).catch(() => {});
  } catch {}

  fetch('/api/videos', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(videoData)
  }).catch(() => {});

  try {
    const ref = doc(db, 'videos', targetId);
    setDoc(ref, videoData, { merge: true }).catch(() => {});
  } catch {}

  return targetId;
}

export async function deleteVideo(id: string) {
  const local = getLocalVideos();
  const updated = local.filter((v) => v.id !== id);
  sharedVideos = updated;
  saveLocalVideos(updated);
  notifyVideoSubscribers();
  emitVideosUpdated();

  try {
    const videoRef = rtdbRef(realtimeDb, `videos/${id}`);
    rtdbRemove(videoRef).catch(() => {});
  } catch {}

  fetch(`https://himrw-fae65-default-rtdb.firebaseio.com/videos/${encodeURIComponent(id)}.json`, {
    method: 'DELETE'
  }).catch(() => {});

  fetch(`/api/videos/${encodeURIComponent(id)}`, { method: 'DELETE' }).catch(() => {});

  try {
    deleteDoc(doc(db, 'videos', id)).catch(() => {});
  } catch {}
}

export async function bumpVideoCounter(
  id: string,
  field: 'views' | 'likes' | 'commentsCount',
  by = 1
): Promise<number> {
  const local = getLocalVideos();
  const idx = local.findIndex((v) => v.id === id);

  if (idx < 0) return 0;

  const currentVal = local[idx][field] || 0;
  const nextVal = Math.max(0, currentVal + by);
  local[idx] = { ...local[idx], [field]: nextVal, updatedAt: Date.now() };
  sharedVideos = local;
  saveLocalVideos(local);

  // Debounced notification to avoid rerendering during active user interactions
  queueMicrotask(() => {
    notifyVideoSubscribers();
    emitVideosUpdated();
  });

  try {
    const valRef = rtdbRef(realtimeDb, `videos/${id}/${field}`);
    rtdbSet(valRef, nextVal).catch(() => {});
  } catch {}

  try {
    fetch(`/api/videos/${encodeURIComponent(id)}/bump`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ field, by })
    }).catch(() => {});
  } catch {}

  try {
    const ref = doc(db, 'videos', id);
    setDoc(ref, { [field]: increment(by), updatedAt: Date.now() }, { merge: true }).catch(() => {});
  } catch {}

  return nextVal;
}
