import { useEffect, useState } from 'react';
import {
  collection,
  deleteDoc,
  doc,
  increment,
  onSnapshot,
  setDoc
} from 'firebase/firestore';
import { ref as rtdbRef, onValue as rtdbOnValue, set as rtdbSet, remove as rtdbRemove } from 'firebase/database';
import { db, realtimeDb } from '../lib/firebase';
import type { Video, VideoStatus } from '../types';

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

function getLocalVideos(): Video[] {
  if (inMemoryVideosCache && inMemoryVideosCache.length > 0) {
    return inMemoryVideosCache.filter(isValidVideo);
  }
  try {
    const raw = localStorage.getItem(LOCAL_VIDEOS_KEY);
    if (raw !== null) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const filtered = parsed.filter(isValidVideo);
        inMemoryVideosCache = filtered;
        return filtered;
      }
    }
  } catch {}
  return [];
}

function saveLocalVideos(list: Video[]) {
  const filtered = list.filter(isValidVideo);
  inMemoryVideosCache = filtered;
  try {
    localStorage.setItem(LOCAL_VIDEOS_KEY, JSON.stringify(filtered));
  } catch {}
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

export function useVideos() {
  const [videos, setVideos] = useState<Video[]>(() => getLocalVideos());
  const [loading, setLoading] = useState(() => getLocalVideos().length === 0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const handleLocalSync = () => {
      const current = getLocalVideos();
      setVideos((prev) => (areVideosEqual(prev, current) ? prev : current));
      if (current.length > 0) {
        setLoading(false);
      }
    };

    window.addEventListener(VIDEOS_EVENT, handleLocalSync);
    window.addEventListener('storage', handleLocalSync);

    // 1. Single ultra-fast fetch from server API (in-memory cached, returns in 1-2ms)
    const fetchInitialVideos = async () => {
      try {
        const res = await fetch('/api/videos');
        if (res.ok) {
          const data = await res.json();
          if (data.success && Array.isArray(data.videos) && isMounted) {
            const serverVideos: Video[] = data.videos
              .map((v: any) => mapVideo(v.id, v))
              .filter((v: Video | null): v is Video => v !== null && isValidVideo(v));
            setVideos((prev) => {
              if (areVideosEqual(prev, serverVideos)) return prev;
              return serverVideos;
            });
            saveLocalVideos(serverVideos);
            setLoading(false);
            return;
          }
        }
      } catch {}

      // Fallback: If server fetch failed, try direct Firebase RTDB REST once
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2500);

        const fbRes = await fetch('https://himrw-fae65-default-rtdb.firebaseio.com/videos.json', {
          signal: controller.signal
        }).finally(() => clearTimeout(timeoutId));

        if (fbRes.ok) {
          const data = await fbRes.json();
          if (data && typeof data === 'object' && isMounted) {
            const list: Video[] = Object.entries(data)
              .filter(([k, v]) => v && typeof v === 'object' && !/^\d+$/.test(k))
              .map(([k, v]) => mapVideo(k, v as Record<string, unknown>))
              .filter((v: Video | null): v is Video => v !== null && isValidVideo(v))
              .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
            setVideos((prev) => (areVideosEqual(prev, list) ? prev : list));
            saveLocalVideos(list);
            setLoading(false);
            return;
          }
        }
      } catch {
        // Fallback silently
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchInitialVideos();

    // 2. Realtime Database listener: only triggers on actual database updates
    let rtdbUnsub = () => {};
    try {
      const vRef = rtdbRef(realtimeDb, 'videos');
      rtdbUnsub = rtdbOnValue(
        vRef,
        (snap) => {
          if (!isMounted) return;
          const val = snap.val();
          if (val && typeof val === 'object') {
            const remoteList: Video[] = Object.entries(val)
              .filter(([k, v]) => v && typeof v === 'object' && !/^\d+$/.test(k))
              .map(([k, v]) => mapVideo(k, v as Record<string, unknown>))
              .filter((v: Video | null): v is Video => v !== null && isValidVideo(v))
              .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
            setVideos((prev) => {
              if (areVideosEqual(prev, remoteList)) return prev;
              return remoteList;
            });
            saveLocalVideos(remoteList);
            setLoading(false);
          } else if (val === null) {
            setVideos([]);
            saveLocalVideos([]);
            setLoading(false);
          }
        },
        (err) => {
          console.warn('Firebase RTDB subscription notice:', err);
        }
      );
    } catch (e) {
      console.warn('Firebase RTDB listener setup notice:', e);
    }

    return () => {
      isMounted = false;
      rtdbUnsub();
      window.removeEventListener(VIDEOS_EVENT, handleLocalSync);
      window.removeEventListener('storage', handleLocalSync);
    };
  }, []);

  return { videos, loading, error };
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
  saveLocalVideos(updatedList);
  emitVideosUpdated();

  // 2. Save to Firebase Realtime Database (Instant global sync in background)
  try {
    const videoRef = rtdbRef(realtimeDb, `videos/${targetId}`);
    rtdbSet(videoRef, videoData).catch(() => {});
  } catch {}

  // 3. Save to Server API (Non-blocking background fetch)
  fetch('/api/videos', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(videoData)
  }).catch(() => {});

  // 4. Firestore cloud save in background
  try {
    const ref = doc(db, 'videos', targetId);
    setDoc(ref, videoData, { merge: true }).catch(() => {});
  } catch {}

  return targetId;
}

export async function deleteVideo(id: string) {
  // 1. Instant local deletion (0ms latency)
  const local = getLocalVideos();
  const updated = local.filter((v) => v.id !== id);
  saveLocalVideos(updated);
  emitVideosUpdated();

  // 2. Firebase Realtime Database deletion via SDK
  try {
    const videoRef = rtdbRef(realtimeDb, `videos/${id}`);
    rtdbRemove(videoRef).catch(() => {});
  } catch {}

  // 3. Direct REST delete to Firebase Realtime Database for 100% guarantee
  try {
    fetch(`https://himrw-fae65-default-rtdb.firebaseio.com/videos/${encodeURIComponent(id)}.json`, {
      method: 'DELETE'
    }).catch(() => {});
  } catch {}

  // 4. Server API deletion in background
  try {
    fetch(`/api/videos/${encodeURIComponent(id)}`, { method: 'DELETE' }).catch(() => {});
  } catch {}

  // 5. Firestore delete in background
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

  // CRITICAL: If the video does NOT exist in local cache, do NOT create a ghost entry in Firebase!
  if (idx < 0) {
    return 0;
  }

  const currentVal = local[idx][field] || 0;
  const nextVal = Math.max(0, currentVal + by);
  local[idx] = { ...local[idx], [field]: nextVal, updatedAt: Date.now() };
  saveLocalVideos(local);
  emitVideosUpdated();

  // Realtime DB bump (only for existing video)
  try {
    const valRef = rtdbRef(realtimeDb, `videos/${id}/${field}`);
    rtdbSet(valRef, nextVal).catch(() => {});
  } catch {}

  // Server bump
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);
    fetch(`/api/videos/${encodeURIComponent(id)}/bump`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ field, by }),
      signal: controller.signal
    })
      .then(() => clearTimeout(timeoutId))
      .catch(() => {
        clearTimeout(timeoutId);
      });
  } catch {}

  // Firestore bump
  try {
    const ref = doc(db, 'videos', id);
    setDoc(ref, { [field]: increment(by), updatedAt: Date.now() }, { merge: true }).catch(() => {});
  } catch {}
  return nextVal;
}
