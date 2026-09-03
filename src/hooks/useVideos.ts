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

function getLocalVideos(): Video[] {
  try {
    const raw = localStorage.getItem(LOCAL_VIDEOS_KEY);
    if (raw !== null) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch {}
  return [];
}

function saveLocalVideos(list: Video[]) {
  try {
    localStorage.setItem(LOCAL_VIDEOS_KEY, JSON.stringify(list));
  } catch {}
}

function mapVideo(id: string, data: Record<string, unknown>): Video {
  return {
    id,
    thumbnailUrl: (data.thumbnailUrl as string) || '',
    embedUrl: (data.embedUrl as string) || '',
    title: (data.title as string) || 'Untitled video',
    sourceName: (data.sourceName as string) || 'Marketify',
    duration: (data.duration as string) || '',
    status: (data.status as Video['status']) || 'active',
    views: typeof data.views === 'number' ? (data.views as number) : 0,
    likes: typeof data.likes === 'number' ? (data.likes as number) : 0,
    commentsCount: typeof data.commentsCount === 'number' ? (data.commentsCount as number) : 0,
    createdAt: (data.createdAt as number) || Date.now(),
    updatedAt: (data.updatedAt as number) || Date.now()
  };
}

export function useVideos() {
  const [videos, setVideos] = useState<Video[]>(() => getLocalVideos());
  const [loading, setLoading] = useState(() => getLocalVideos().length === 0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const handleLocalSync = () => {
      const current = getLocalVideos();
      setVideos(current);
      if (current.length > 0) {
        setLoading(false);
      }
    };

    window.addEventListener(VIDEOS_EVENT, handleLocalSync);
    window.addEventListener('storage', handleLocalSync);

    // 1. Fetch from server API
    const fetchAllVideos = async () => {
      // 1. Fetch from server API first (ultra-fast, local cache)
      try {
        const res = await fetch('/api/videos');
        if (res.ok) {
          const data = await res.json();
          if (data.success && Array.isArray(data.videos) && isMounted) {
            const serverVideos: Video[] = data.videos.map((v: any) => mapVideo(v.id, v));
            setVideos(serverVideos);
            saveLocalVideos(serverVideos);
            setLoading(false);
          }
        }
      } catch {}

      // 2. Direct REST fetch from Firebase Realtime Database with fast timeout fallback
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
              .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
            setVideos(list);
            saveLocalVideos(list);
            setLoading(false);
            return;
          } else if (data === null && isMounted) {
            setVideos([]);
            saveLocalVideos([]);
            setLoading(false);
            return;
          }
        }
      } catch {
        // Fallback silently if offline or blocked
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchAllVideos();
    const pollInterval = setInterval(fetchAllVideos, 4000);

    // 2. Realtime Database listener (Instant global real-time sync across all devices)
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
              .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
            setVideos(remoteList);
            saveLocalVideos(remoteList);
          } else if (val === null) {
            setVideos([]);
            saveLocalVideos([]);
          }
        },
        (err) => {
          console.warn('Firebase RTDB subscription notice:', err);
        }
      );
    } catch (e) {
      console.warn('Firebase RTDB listener setup notice:', e);
    }

    // 3. Parallel Firestore realtime listener
    let firestoreUnsub = () => {};
    try {
      firestoreUnsub = onSnapshot(
        collection(db, 'videos'),
        (snap) => {
          if (isMounted) {
            if (!snap.empty) {
              const remote = snap.docs
                .map((d) => mapVideo(d.id, d.data()))
                .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
              setVideos(remote);
              saveLocalVideos(remote);
            }
          }
        },
        (err) => {
          console.warn('Firestore videos snapshot notice:', err);
        }
      );
    } catch (e) {
      console.warn('Firestore subscription notice:', e);
    }

    return () => {
      isMounted = false;
      clearInterval(pollInterval);
      rtdbUnsub();
      firestoreUnsub();
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
    embedUrl: payload.embedUrl || '',
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

  // 2. Firebase Realtime Database deletion in background
  try {
    const videoRef = rtdbRef(realtimeDb, `videos/${id}`);
    rtdbRemove(videoRef).catch(() => {});
  } catch {}

  // 3. Server API deletion in background
  fetch(`/api/videos/${encodeURIComponent(id)}`, { method: 'DELETE' }).catch(() => {});

  // 4. Firestore delete in background
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
  let nextVal = by > 0 ? by : 0;
  if (idx >= 0) {
    const currentVal = local[idx][field] || 0;
    nextVal = Math.max(0, currentVal + by);
    local[idx] = { ...local[idx], [field]: nextVal, updatedAt: Date.now() };
    saveLocalVideos(local);
    emitVideosUpdated();
  }

  // Realtime DB bump
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
