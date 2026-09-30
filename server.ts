import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';

const PORT = 3000;
const DATA_DIR = path.join(process.cwd(), 'data');
const VIDEOS_FILE = path.join(DATA_DIR, 'videos.json');
const ADS_FILE = path.join(DATA_DIR, 'ads.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DEFAULT_BANNER_SCRIPT = `<script>
  atOptions = {
    'key' : '280410b8223e51dae425f09c7a2f0eb1',
    'format' : 'iframe',
    'height' : 60,
    'width' : 468,
    'params' : {}
  };
</script>
<script src="https://glamourpicklessteward.com/280410b8223e51dae425f09c7a2f0eb1/invoke.js"></script>`;

const DEFAULT_SOCIAL_BAR_1 = `<script src="https://glamourpicklessteward.com/a4/12/67/a412679a12b000c8cd0a802095a46290.js"></script>`;
const DEFAULT_SOCIAL_BAR_2 = `<script src="https://glamourpicklessteward.com/a4/12/67/a412679a12b000c8fd0a802095a46290.js"></script>`;

const INITIAL_ADS = [
  {
    id: 'banner_468x60',
    name: '468x60 Banner Ad',
    type: 'banner_468x60',
    script: DEFAULT_BANNER_SCRIPT,
    status: 'on',
    placement: 'Public Feed & Video Page',
    createdAt: Date.now(),
    updatedAt: Date.now()
  },
  {
    id: 'social_bar_1',
    name: 'Social Bar Ad #1',
    type: 'social_bar',
    script: DEFAULT_SOCIAL_BAR_1,
    status: 'on',
    placement: 'Public Frontend',
    createdAt: Date.now(),
    updatedAt: Date.now()
  },
  {
    id: 'social_bar_2',
    name: 'Social Bar Ad #2',
    type: 'social_bar',
    script: DEFAULT_SOCIAL_BAR_2,
    status: 'on',
    placement: 'Public Frontend',
    createdAt: Date.now(),
    updatedAt: Date.now()
  }
];

const INITIAL_VIDEOS: Array<{
  id: string;
  thumbnailUrl: string;
  embedUrl: string;
  title: string;
  sourceName: string;
  duration: string;
  status: string;
  views: number;
  likes: number;
  commentsCount: number;
  createdAt: number;
  updatedAt: number;
}> = [];

let inMemoryServerVideos: any[] | null = null;
let inMemoryServerAds: any[] | null = null;

function isValidServerVideo(v: any) {
  if (!v || !v.id) return false;
  const hasEmbed = typeof v.embedUrl === 'string' && v.embedUrl.trim().length > 0;
  const hasWebsite =
    (typeof v.websiteUrl === 'string' && v.websiteUrl.trim().length > 0) ||
    (typeof v.targetUrl === 'string' && v.targetUrl.trim().length > 0);
  return hasEmbed || hasWebsite;
}

function readVideos() {
  if (inMemoryServerVideos !== null) {
    return inMemoryServerVideos;
  }
  try {
    if (fs.existsSync(VIDEOS_FILE)) {
      const data = fs.readFileSync(VIDEOS_FILE, 'utf-8');
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed)) {
        inMemoryServerVideos = parsed.filter(isValidServerVideo);
        return inMemoryServerVideos;
      }
    }
  } catch (err) {
    console.error('Error reading videos:', err);
  }
  inMemoryServerVideos = INITIAL_VIDEOS;
  return inMemoryServerVideos;
}

function writeVideos(videos: any[]) {
  const valid = videos.filter(isValidServerVideo);
  inMemoryServerVideos = valid;
  try {
    fs.writeFileSync(VIDEOS_FILE, JSON.stringify(valid, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error writing videos:', err);
  }
}

function readAds() {
  if (inMemoryServerAds !== null) {
    return inMemoryServerAds;
  }
  try {
    if (fs.existsSync(ADS_FILE)) {
      const data = fs.readFileSync(ADS_FILE, 'utf-8');
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed)) {
        inMemoryServerAds = parsed;
        return inMemoryServerAds;
      }
    }
  } catch (err) {
    console.error('Error reading ads:', err);
  }
  inMemoryServerAds = INITIAL_ADS;
  return inMemoryServerAds;
}

function writeAds(ads: any[]) {
  inMemoryServerAds = ads;
  try {
    fs.writeFileSync(ADS_FILE, JSON.stringify(ads, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error writing ads:', err);
  }
}

const RTDB_BASE_URL = 'https://himrw-fae65-default-rtdb.firebaseio.com';
let lastFirebaseSyncError = 0;
const FIREBASE_RETRY_COOLDOWN = 60000; // 1 minute cooldown if unreachable

async function syncFromFirebase() {
  // If recently timed out or failed, skip to avoid latency
  if (Date.now() - lastFirebaseSyncError < FIREBASE_RETRY_COOLDOWN) {
    return readVideos();
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    const res = await fetch(`${RTDB_BASE_URL}/videos.json`, {
      signal: controller.signal
    }).finally(() => clearTimeout(timeoutId));

    if (res.ok) {
      const data = await res.json();
      if (data && typeof data === 'object') {
        const validList: any[] = [];
        const corruptedKeys: string[] = [];

        for (const [id, val] of Object.entries(data)) {
          if (!val || typeof val !== 'object' || /^\d+$/.test(id)) continue;
          const v = val as any;
          const hasEmbed = v.embedUrl && typeof v.embedUrl === 'string' && v.embedUrl.trim();
          const hasWebsite = v.websiteUrl && typeof v.websiteUrl === 'string' && v.websiteUrl.trim();
          if (!hasEmbed && !hasWebsite) {
            corruptedKeys.push(id);
            continue;
          }
          validList.push({ id, ...v });
        }

        // Purge corrupted/empty keys permanently from Firebase
        if (corruptedKeys.length > 0) {
          for (const badId of corruptedKeys) {
            deleteFromFirebase(badId).catch(() => {});
          }
        }

        validList.sort((a: any, b: any) => (b.createdAt || 0) - (a.createdAt || 0));
        writeVideos(validList);
        return validList;
      } else if (data === null) {
        writeVideos([]);
        return [];
      }
    }
  } catch {
    lastFirebaseSyncError = Date.now();
  }
  return readVideos();
}

async function syncToFirebase(videoId: string, videoObj: any) {
  if (!videoObj || (!videoObj.embedUrl && !videoObj.websiteUrl)) return;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);
    await fetch(`${RTDB_BASE_URL}/videos/${encodeURIComponent(videoId)}.json`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(videoObj),
      signal: controller.signal
    }).finally(() => clearTimeout(timeoutId));
  } catch {
    lastFirebaseSyncError = Date.now();
  }
}

async function deleteFromFirebase(videoId: string) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    await fetch(`${RTDB_BASE_URL}/videos/${encodeURIComponent(videoId)}.json`, {
      method: 'DELETE',
      signal: controller.signal
    }).finally(() => clearTimeout(timeoutId));
  } catch (err) {
    console.error('Failed to delete from Firebase RTDB:', err);
  }
}

async function syncAdsFromFirebase() {
  if (Date.now() - lastFirebaseSyncError < FIREBASE_RETRY_COOLDOWN) {
    return readAds();
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);

    const res = await fetch(`${RTDB_BASE_URL}/ads.json`, {
      signal: controller.signal
    }).finally(() => clearTimeout(timeoutId));

    if (res.ok) {
      const data = await res.json();
      if (data && typeof data === 'object') {
        const list = Object.entries(data)
          .filter(([k, v]) => v && typeof v === 'object')
          .map(([id, val]: [string, any]) => ({ id, ...(val || {}) }));
        if (list.length > 0) {
          writeAds(list);
          return list;
        }
      }
    }
  } catch {
    lastFirebaseSyncError = Date.now();
  }
  return readAds();
}

async function syncAdToFirebase(adId: string, adObj: any) {
  if (Date.now() - lastFirebaseSyncError < FIREBASE_RETRY_COOLDOWN) return;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);
    await fetch(`${RTDB_BASE_URL}/ads/${encodeURIComponent(adId)}.json`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(adObj),
      signal: controller.signal
    }).finally(() => clearTimeout(timeoutId));
  } catch {
    lastFirebaseSyncError = Date.now();
  }
}

async function deleteAdFromFirebase(adId: string) {
  if (Date.now() - lastFirebaseSyncError < FIREBASE_RETRY_COOLDOWN) return;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);
    await fetch(`${RTDB_BASE_URL}/ads/${encodeURIComponent(adId)}.json`, {
      method: 'DELETE',
      signal: controller.signal
    }).finally(() => clearTimeout(timeoutId));
  } catch {
    lastFirebaseSyncError = Date.now();
  }
}

// Periodic background sync every 60s
syncFromFirebase();
syncAdsFromFirebase();
setInterval(() => {
  syncFromFirebase().catch(() => {});
  syncAdsFromFirebase().catch(() => {});
}, 60000);

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '10mb' }));

  // --- API Routes ---
  app.get('/api/videos', (req, res) => {
    // Return cached videos instantly from memory in 1ms
    const videos = readVideos();
    res.setHeader('Cache-Control', 'public, max-age=5, stale-while-revalidate=30');
    res.json({ success: true, videos });
  });

  app.get('/api/ads', (req, res) => {
    const ads = readAds();
    res.setHeader('Cache-Control', 'public, max-age=10, stale-while-revalidate=60');
    res.json({ success: true, ads });
  });

  app.post('/api/videos', (req, res) => {
    const payload = req.body;
    const hasEmbed = payload && typeof payload.embedUrl === 'string' && payload.embedUrl.trim().length > 0;
    const hasWebsite = payload && typeof payload.websiteUrl === 'string' && payload.websiteUrl.trim().length > 0;
    if (!payload || (!hasEmbed && !hasWebsite)) {
      return res.status(400).json({ error: 'embedUrl or websiteUrl is required' });
    }

    const videos = readVideos();
    const now = Date.now();
    const id = payload.id || `vid_${now}_${Math.random().toString(36).substring(2, 7)}`;
    const existingIdx = videos.findIndex((v: any) => v.id === id);

    const videoObj = {
      id,
      thumbnailUrl: payload.thumbnailUrl || '',
      embedUrl: payload.embedUrl || '',
      websiteUrl: payload.websiteUrl || '',
      title: payload.title || 'Untitled video',
      sourceName: payload.sourceName || 'Marketify',
      duration: payload.duration || '',
      status: payload.status || 'active',
      views: payload.views ?? (existingIdx >= 0 ? videos[existingIdx].views : 0),
      likes: payload.likes ?? (existingIdx >= 0 ? videos[existingIdx].likes : 0),
      commentsCount: 0,
      createdAt: payload.createdAt || (existingIdx >= 0 ? videos[existingIdx].createdAt : now),
      updatedAt: now
    };

    if (existingIdx >= 0) {
      videos[existingIdx] = { ...videos[existingIdx], ...videoObj };
    } else {
      videos.unshift(videoObj);
    }

    writeVideos(videos);
    syncToFirebase(id, videoObj);
    res.json({ success: true, video: videoObj, id });
  });

  app.delete('/api/videos/:id', (req, res) => {
    const { id } = req.params;
    const videos = readVideos().filter((v: any) => v.id !== id);
    writeVideos(videos);
    deleteFromFirebase(id);
    res.json({ success: true });
  });

  app.post('/api/videos/:id/bump', (req, res) => {
    const { id } = req.params;
    const { field, by = 1 } = req.body;
    const videos = readVideos();
    const idx = videos.findIndex((v: any) => v.id === id);
    if (idx >= 0 && (field === 'views' || field === 'likes' || field === 'commentsCount')) {
      videos[idx][field] = Math.max(0, (videos[idx][field] || 0) + by);
      videos[idx].updatedAt = Date.now();
      writeVideos(videos);
      syncToFirebase(id, videos[idx]);
      return res.json({ success: true, count: videos[idx][field] });
    }
    return res.status(404).json({ success: false, error: 'Video not found' });
  });

  app.get('/api/ads', (req, res) => {
    const ads = readAds();
    res.json({ success: true, ads });

    // Background sync
    syncAdsFromFirebase().catch(() => {});
  });

  app.post('/api/ads', (req, res) => {
    const ad = req.body;
    if (!ad || !ad.id) {
      return res.status(400).json({ error: 'Ad with id is required' });
    }

    const ads = readAds();
    const idx = ads.findIndex((a: any) => a.id === ad.id);
    const updatedAd = { ...ad, updatedAt: Date.now() };

    if (idx >= 0) {
      ads[idx] = { ...ads[idx], ...updatedAd };
    } else {
      ads.push(updatedAd);
    }

    writeAds(ads);
    syncAdToFirebase(ad.id, updatedAd);
    res.json({ success: true, ad: updatedAd });
  });

  app.delete('/api/ads/:id', (req, res) => {
    const { id } = req.params;
    const ads = readAds().filter((a: any) => a.id !== id);
    writeAds(ads);
    deleteAdFromFirebase(id);
    res.json({ success: true });
  });

  // --- Vite Middleware / Static Serving ---
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Live Server running on http://localhost:${PORT}`);
  });
}

startServer();
