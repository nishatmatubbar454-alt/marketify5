import { useEffect, useState } from 'react';
import {
  increment
} from 'firebase/firestore';
import { ref as rtdbRef, get as rtdbGet } from 'firebase/database';
import {
  primaryRealtimeDb,
  secondaryRealtimeDb,
  backupRealtimeDb,
  RTDB_ENDPOINTS,
  fetchRtdbJson,
  fetchVideoByIdAcrossFirebases,
  loadBalancedFetch,
  dualRtdbSet,
  dualRtdbRemove,
  dualFirestoreSetDoc,
  dualFirestoreDeleteDoc
} from '../lib/firebase';
import type { Video, VideoStatus } from '../types';
import { INITIAL_VIDEOS } from '../data/initialVideos';
import { getIdbVideos, setIdbVideos } from '../utils/idbCache';
import { isPermanentlyLocked } from '../utils/security';

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
  void setIdbVideos(filtered);
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
    updatedAt: (data.updatedAt as number) || (data.createdAt as number) || 0,
    deletedAt: typeof data.deletedAt === 'number' ? data.deletedAt : undefined
  };
}

function mergeVideos(base: Video[], incoming: Video[]): Video[] {
  const map = new Map<string, Video>();
  for (const v of base) {
    if (isValidVideo(v)) {
      map.set(v.id, v);
    }
  }
  for (const v of incoming) {
    if (!isValidVideo(v)) continue;
    const prev = map.get(v.id);
    if (!prev) {
      map.set(v.id, v);
    } else {
      const prevTime = prev.updatedAt || prev.createdAt || 0;
      const nextTime = v.updatedAt || v.createdAt || 0;
      if (nextTime >= prevTime) {
        map.set(v.id, {
          ...prev,
          ...v,
          thumbnailUrl: v.thumbnailUrl || prev.thumbnailUrl || '',
          embedUrl: v.embedUrl || prev.embedUrl || '',
          websiteUrl: v.websiteUrl || prev.websiteUrl || '',
          views: Math.max(prev.views || 0, v.views || 0),
          likes: Math.max(prev.likes || 0, v.likes || 0)
        });
      }
    }
  }
  return Array.from(map.values()).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}

function parseVideoMap(val: unknown): Video[] {
  if (!val || typeof val !== 'object') return [];
  return Object.entries(val as Record<string, unknown>)
    .filter(([k, v]) => v && typeof v === 'object' && !/^\d+$/.test(k))
    .map(([k, v]) => mapVideo(k, v as Record<string, unknown>))
    .filter((v: Video | null): v is Video => v !== null && isValidVideo(v));
}

function areVideosEqual(a: Video[], b: Video[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (
      a[i].id !== b[i].id ||
      a[i].updatedAt !== b[i].updatedAt ||
      a[i].status !== b[i].status ||
      a[i].views !== b[i].views ||
      a[i].likes !== b[i].likes
    ) {
      return false;
    }
  }
  return true;
}

// Global in-memory singleton for instant 0ms access
let sharedVideos: Video[] = getLocalVideos();
const videoSubscribers = new Set<(videos: Video[]) => void>();
let isVideosInitialized = false;
let activeFirebaseSync: Promise<boolean> | null = null;
let fullCatalogMergedOnce = false;

function notifyVideoSubscribers() {
  videoSubscribers.forEach((fn) => fn(sharedVideos));
}

function applyMergedVideos(incoming: Video[]): boolean {
  if (incoming.length === 0) return false;
  const merged = mergeVideos(sharedVideos, incoming);
  if (!areVideosEqual(sharedVideos, merged)) {
    sharedVideos = merged;
    saveLocalVideos(merged);
    notifyVideoSubscribers();
    return true;
  }
  return false;
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

  // Instantly load cached videos from local IndexedDB (~10-20ms) and merge with INITIAL_VIDEOS
  getIdbVideos()
    .then((cached) => {
      if (cached && cached.length > 0) {
        applyMergedVideos(cached);
      }
    })
    .catch(() => {});

  // Load & union-merge videos across ALL 3 Firebase RTDBs (maka-bfd59 + himrw-fae65 + backup-markitify)
  const loadVideosFromFirebase = async (): Promise<boolean> => {
    if (activeFirebaseSync) return activeFirebaseSync;

    activeFirebaseSync = (async () => {
      let updated = false;
      try {
        // PHASE 1 (~400ms, ~70 KB): Fetch newest 250 videos from ALL 3 Firebases concurrently!
        const recentResponses = await Promise.allSettled(
          RTDB_ENDPOINTS.map((ep) =>
            fetchRtdbJson<Record<string, unknown>>(ep, '/videos.json?orderBy=%22$key%22&limitToLast=250', 10000)
          )
        );

        const recentBatch: Video[] = [];
        for (const r of recentResponses) {
          if (r.status === 'fulfilled' && r.value) {
            recentBatch.push(...parseVideoMap(r.value));
          }
        }
        if (recentBatch.length > 0 && applyMergedVideos(recentBatch)) {
          updated = true;
        }

        // PHASE 2 (~300ms, ~60 KB): Check ALL video IDs across ALL 3 Firebases via shallow=true
        const shallowResponses = await Promise.allSettled(
          RTDB_ENDPOINTS.map((ep) =>
            fetchRtdbJson<Record<string, unknown>>(ep, '/videos.json?shallow=true', 10000)
          )
        );

        const remoteKeySet = new Set<string>();
        for (const r of shallowResponses) {
          if (r.status === 'fulfilled' && r.value && typeof r.value === 'object') {
            for (const k of Object.keys(r.value)) {
              if (!/^\d+$/.test(k)) remoteKeySet.add(k);
            }
          }
        }

        const currentIdSet = new Set(sharedVideos.map((v) => v.id));
        const missingIds = Array.from(remoteKeySet).filter((id) => !currentIdSet.has(id));

        if (missingIds.length > 0 && missingIds.length <= 150) {
          // Targeted fast fetch of ONLY missing videos (avoids 20 MB re-download on mobile!)
          const BATCH_SIZE = 15;
          const fetchedMissing: Video[] = [];
          for (let i = 0; i < missingIds.length; i += BATCH_SIZE) {
            const chunk = missingIds.slice(i, i + BATCH_SIZE);
            const results = await Promise.allSettled(
              chunk.map(async (vidId) => {
                const raw = await fetchVideoByIdAcrossFirebases(vidId);
                return raw ? mapVideo(vidId, raw) : null;
              })
            );
            for (const res of results) {
              if (res.status === 'fulfilled' && res.value && isValidVideo(res.value)) {
                fetchedMissing.push(res.value);
              }
            }
          }
          if (fetchedMissing.length > 0 && applyMergedVideos(fetchedMissing)) {
            updated = true;
          }
        } else if (missingIds.length > 150 || (!fullCatalogMergedOnce && remoteKeySet.size > sharedVideos.length)) {
          // Brand new cache or large delta: fetch full catalog with 45s timeout (never aborts at 3.5s!)
          fullCatalogMergedOnce = true;
          let fullLoaded = false;

          // Try primary & backup REST first, then secondary
          for (const ep of [RTDB_ENDPOINTS[0], RTDB_ENDPOINTS[2], RTDB_ENDPOINTS[1]]) {
            const val = await fetchRtdbJson<Record<string, unknown>>(ep, '/videos.json', 45000);
            if (val && typeof val === 'object') {
              const list = parseVideoMap(val);
              if (list.length > 0) {
                if (applyMergedVideos(list)) updated = true;
                fullLoaded = true;
                break;
              }
            }
          }

          // Top up any IDs that were only in another RTDB after full fetch
          if (fullLoaded) {
            const updatedSet = new Set(sharedVideos.map((v) => v.id));
            const stillMissing = Array.from(remoteKeySet).filter((id) => !updatedSet.has(id));
            if (stillMissing.length > 0 && stillMissing.length <= 100) {
              const extra: Video[] = [];
              for (let i = 0; i < stillMissing.length; i += 15) {
                const chunk = stillMissing.slice(i, i + 15);
                const results = await Promise.allSettled(
                  chunk.map(async (vidId) => {
                    const raw = await fetchVideoByIdAcrossFirebases(vidId);
                    return raw ? mapVideo(vidId, raw) : null;
                  })
                );
                for (const res of results) {
                  if (res.status === 'fulfilled' && res.value && isValidVideo(res.value)) {
                    extra.push(res.value);
                  }
                }
              }
              if (extra.length > 0 && applyMergedVideos(extra)) {
                updated = true;
              }
            }
          } else {
            // Last-resort SDK fallback across all 3 Firebases
            for (const rtdb of [primaryRealtimeDb, backupRealtimeDb, secondaryRealtimeDb]) {
              try {
                const snap = await rtdbGet(rtdbRef(rtdb, 'videos'));
                const list = parseVideoMap(snap.val());
                if (list.length > 0 && applyMergedVideos(list)) {
                  updated = true;
                  break;
                }
              } catch {}
            }
          }
        }
      } catch {} finally {
        activeFirebaseSync = null;
      }
      return updated;
    })();

    return activeFirebaseSync;
  };

  // 1. Try local Express server API if available, AND always merge from Firebase too
  fetch('/api/videos')
    .then((res) => (res.ok ? res.json() : null))
    .then((data) => {
      if (data && data.success && Array.isArray(data.videos) && data.videos.length > 0) {
        const serverVideos: Video[] = data.videos
          .map((v: any) => mapVideo(v.id, v))
          .filter((v: Video | null): v is Video => v !== null && isValidVideo(v));
        applyMergedVideos(serverVideos);
      }
    })
    .catch(() => {})
    .finally(() => {
      loadVideosFromFirebase();
    });

  // 2. Gentle background refresh every 60s & on tab focus
  const poll = () => {
    if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
      fetch('/api/videos', { cache: 'default' })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data && data.success && Array.isArray(data.videos) && data.videos.length > 0) {
            const serverVideos: Video[] = data.videos
              .map((v: any) => mapVideo(v.id, v))
              .filter((v: Video | null): v is Video => v !== null && isValidVideo(v));
            applyMergedVideos(serverVideos);
          }
        })
        .catch(() => {})
        .finally(() => {
          loadVideosFromFirebase();
        });
    }
  };

  setInterval(poll, 60000);
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

  // 2. Multi-Write sync to ALL 3 Firebase RTDBs (including backup-markitify) & server API
  try {
    await dualRtdbSet(`videos/${targetId}`, videoData);
  } catch {}

  const adminToken = typeof window !== 'undefined' ? localStorage.getItem('mk-session-token') : null;
  fetch('/api/videos', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(adminToken ? { Authorization: `Bearer ${adminToken}` } : {})
    },
    body: JSON.stringify(videoData)
  }).catch(() => {});

  try {
    dualFirestoreSetDoc('videos', targetId, videoData).catch(() => {});
  } catch {}

  return targetId;
}

/**
 * Moves video to 30-Day Recycle Bin (Soft Delete).
 * If the video is > 30 days old, deletion is strictly prohibited (Permanently Locked).
 * Physical data in Firebase is NEVER wiped out.
 */
export async function trashVideo(id: string): Promise<void> {
  const local = getLocalVideos();
  const existing = local.find((v) => v.id === id);
  if (!existing) return;

  if (isPermanentlyLocked(existing)) {
    throw new Error('এই ভিডিওটি ৩০ দিনের বেশি পুরনো হওয়ায় এটি স্থায়ীভাবে লক হয়ে গেছে। এটি ডিলিট করা নিষিদ্ধ।');
  }

  const now = Date.now();
  const trashedVideo: Video = {
    ...existing,
    status: 'trashed',
    deletedAt: now,
    updatedAt: now
  };

  const updated = local.map((v) => (v.id === id ? trashedVideo : v));
  sharedVideos = updated;
  saveLocalVideos(updated);
  notifyVideoSubscribers();
  emitVideosUpdated();

  // Dual-write trashed state to both Firebase RTDBs & Firestore
  try {
    dualRtdbSet(`videos/${id}`, trashedVideo).catch(() => {});
  } catch {}

  try {
    dualFirestoreSetDoc('videos', id, trashedVideo).catch(() => {});
  } catch {}

  const adminToken = typeof window !== 'undefined' ? localStorage.getItem('mk-session-token') : null;
  fetch(`/api/videos/${encodeURIComponent(id)}/trash`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(adminToken ? { Authorization: `Bearer ${adminToken}` } : {})
    },
    body: JSON.stringify({ deletedAt: now })
  }).catch(() => {});
}

export const deleteVideo = trashVideo;

/**
 * Restores a video from Recycle Bin back to active status
 */
export async function restoreVideo(id: string): Promise<void> {
  const local = getLocalVideos();
  const existing = local.find((v) => v.id === id);
  if (!existing) return;

  const now = Date.now();
  const restoredVideo: Video = {
    ...existing,
    status: 'active',
    deletedAt: undefined,
    updatedAt: now
  };

  const updated = local.map((v) => (v.id === id ? restoredVideo : v));
  sharedVideos = updated;
  saveLocalVideos(updated);
  notifyVideoSubscribers();
  emitVideosUpdated();

  // Dual-write restored active state to both Firebase RTDBs & Firestore
  try {
    dualRtdbSet(`videos/${id}`, restoredVideo).catch(() => {});
  } catch {}

  try {
    dualFirestoreSetDoc('videos', id, restoredVideo).catch(() => {});
  } catch {}

  const adminToken = typeof window !== 'undefined' ? localStorage.getItem('mk-session-token') : null;
  fetch(`/api/videos/${encodeURIComponent(id)}/restore`, {
    method: 'POST',
    headers: {
      ...(adminToken ? { Authorization: `Bearer ${adminToken}` } : {})
    }
  }).catch(() => {});
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

  // Dual update counter in both Firebase RTDBs
  try {
    dualRtdbSet(`videos/${id}/${field}`, nextVal).catch(() => {});
  } catch {}

  try {
    fetch(`/api/videos/${encodeURIComponent(id)}/bump`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ field, by })
    }).catch(() => {});
  } catch {}

  // Dual increment in both Firestore databases
  try {
    dualFirestoreSetDoc('videos', id, { [field]: increment(by), updatedAt: Date.now() }, { merge: true }).catch(() => {});
  } catch {}

  return nextVal;
}
