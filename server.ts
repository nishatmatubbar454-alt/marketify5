import express from 'express';
import compression from 'compression';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { createServer as createViteServer } from 'vite';

const PORT = 3000;
const DATA_DIR = path.join(process.cwd(), 'data');
const VIDEOS_FILE = path.join(DATA_DIR, 'videos.json');
const ADS_FILE = path.join(DATA_DIR, 'ads.json');
const AUTH_FILE = path.join(DATA_DIR, 'admin-auth.json');
const SESSIONS_FILE = path.join(DATA_DIR, 'admin-sessions.json');
const ANALYTICS_FILE = path.join(DATA_DIR, 'analytics.json');

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
  app.use(compression({
    level: 9,
    threshold: 128
  }) as any);
  app.use(express.json({ limit: '10mb' }));

  // --- API Routes with ETag and Gzip Level 9 for minimal data usage ---
  app.get('/api/videos', (req, res) => {
    const videos = readVideos();
    const lastModified = videos.length > 0 ? (videos[0].updatedAt || videos[0].createdAt || 0) : 0;
    const etag = `W/"vid-${videos.length}-${lastModified}"`;

    if (req.headers['if-none-match'] === etag) {
      return res.status(304).end();
    }

    res.setHeader('ETag', etag);
    res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=180');
    res.json({ success: true, videos });
  });

  app.get('/api/ads', (req, res) => {
    const ads = readAds();
    const lastModified = ads.length > 0 ? (ads[0].updatedAt || 0) : 0;
    const etag = `W/"ads-${ads.length}-${lastModified}"`;

    if (req.headers['if-none-match'] === etag) {
      return res.status(304).end();
    }

    res.setHeader('ETag', etag);
    res.setHeader('Cache-Control', 'public, max-age=120, stale-while-revalidate=300');
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

  app.get('/api/videos/:id', (req, res) => {
    const { id } = req.params;
    const videos = readVideos();
    const found = videos.find((v: any) => v.id === id);
    if (found) {
      return res.json({ success: true, video: found });
    }
    res.status(404).json({ success: false, error: 'Video not found' });
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

  // --- Admin Security & Cryptographic Auth ---
  const readAuthConfig = () => {
    try {
      if (fs.existsSync(AUTH_FILE)) {
        return JSON.parse(fs.readFileSync(AUTH_FILE, 'utf-8'));
      }
    } catch {}
    const fallback = {
      salt: 'mk_sec_9f8b2e1a4c7d0e3f',
      hash: '348638291767b3891a480262edf390bb8120606f6a116641a50590fc9c9d0ee5',
      iterations: 100000,
      algorithm: 'pbkdf2-sha256',
      updatedAt: Date.now()
    };
    try {
      fs.writeFileSync(AUTH_FILE, JSON.stringify(fallback, null, 2), 'utf-8');
    } catch {}
    return fallback;
  };

  const readSessions = (): Record<string, { role: string; createdAt: number; expiresAt: number }> => {
    try {
      if (fs.existsSync(SESSIONS_FILE)) {
        return JSON.parse(fs.readFileSync(SESSIONS_FILE, 'utf-8'));
      }
    } catch {}
    return {};
  };

  const writeSessions = (sessions: Record<string, any>) => {
    try {
      fs.writeFileSync(SESSIONS_FILE, JSON.stringify(sessions, null, 2), 'utf-8');
    } catch {}
  };

  const loginAttempts = new Map<string, { count: number; lockedUntil: number }>();

  const verifyPassHash = (password: string): boolean => {
    const authConfig = readAuthConfig();
    const computedHash = crypto
      .pbkdf2Sync(password, authConfig.salt, authConfig.iterations || 100000, 32, 'sha256')
      .toString('hex');
    const storedBuf = Buffer.from(authConfig.hash, 'hex');
    const computedBuf = Buffer.from(computedHash, 'hex');
    if (storedBuf.length !== computedBuf.length) return false;
    return crypto.timingSafeEqual(storedBuf, computedBuf);
  };

  app.post('/api/auth/login', (req, res) => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    const attempt = loginAttempts.get(ip) || { count: 0, lockedUntil: 0 };

    if (attempt.lockedUntil > now) {
      const remainingMinutes = Math.ceil((attempt.lockedUntil - now) / 60000);
      return res.status(429).json({
        success: false,
        error: `অত্যধিক ভুল চেষ্টার কারণে একাউন্ট সাময়িকভাবে লক হয়েছে। অনুগ্রহ করে ${remainingMinutes} মিনিট পর আবার চেষ্টা করুন।`
      });
    }

    const { password } = req.body || {};
    if (!password || typeof password !== 'string') {
      return res.status(400).json({ success: false, error: 'Password is required' });
    }

    const isValid = verifyPassHash(password.trim());
    if (!isValid) {
      attempt.count += 1;
      if (attempt.count >= 5) {
        attempt.lockedUntil = now + 15 * 60 * 1000;
        attempt.count = 0;
      }
      loginAttempts.set(ip, attempt);
      return setTimeout(() => {
        res.status(401).json({ success: false, error: 'ভুল পাসওয়ার্ড! অ্যাক্সেস প্রত্যাখ্যাত।' });
      }, 350);
    }

    loginAttempts.delete(ip);

    const token = crypto.randomBytes(32).toString('hex');
    const sessions = readSessions();
    const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;
    sessions[token] = {
      role: 'admin',
      createdAt: now,
      expiresAt: now + SEVEN_DAYS
    };
    writeSessions(sessions);

    return res.json({
      success: true,
      token,
      session: {
        role: 'admin',
        name: 'Administrator'
      }
    });
  });

  app.post('/api/auth/verify', (req, res) => {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.replace(/^Bearer\s+/i, '') || req.body?.token;
    if (!token) {
      return res.status(401).json({ success: false, valid: false });
    }
    const sessions = readSessions();
    const session = sessions[token];
    if (session && session.expiresAt > Date.now()) {
      return res.json({ success: true, valid: true, session: { role: session.role, name: 'Administrator' } });
    }
    return res.status(401).json({ success: false, valid: false });
  });

  app.post('/api/auth/logout', (req, res) => {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.replace(/^Bearer\s+/i, '') || req.body?.token;
    if (token) {
      const sessions = readSessions();
      delete sessions[token];
      writeSessions(sessions);
    }
    res.json({ success: true });
  });

  app.post('/api/auth/change-password', (req, res) => {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.replace(/^Bearer\s+/i, '') || req.body?.token;
    const sessions = readSessions();
    const session = sessions[token];
    if (!session || session.expiresAt <= Date.now()) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const { currentPassword, newPassword } = req.body || {};
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, error: 'Current and new passwords are required' });
    }

    if (!verifyPassHash(String(currentPassword).trim())) {
      return res.status(400).json({ success: false, error: 'বর্তমান পাসওয়ার্ডটি সঠিক নয়!' });
    }

    if (String(newPassword).trim().length < 4) {
      return res.status(400).json({ success: false, error: 'নতুন পাসওয়ার্ড অন্তত ৪ অক্ষরের হতে হবে।' });
    }

    const newSalt = 'mk_' + crypto.randomBytes(16).toString('hex');
    const newHash = crypto
      .pbkdf2Sync(String(newPassword).trim(), newSalt, 100000, 32, 'sha256')
      .toString('hex');

    const updatedConfig = {
      salt: newSalt,
      hash: newHash,
      iterations: 100000,
      algorithm: 'pbkdf2-sha256',
      updatedAt: Date.now()
    };
    fs.writeFileSync(AUTH_FILE, JSON.stringify(updatedConfig, null, 2), 'utf-8');

    const updatedSessions: Record<string, any> = {};
    if (token && sessions[token]) {
      updatedSessions[token] = sessions[token];
    }
    writeSessions(updatedSessions);

    res.json({ success: true, message: 'পাসওয়ার্ড সফলভাবে ইনক্রিপ্ট করে আপডেট করা হয়েছে।' });
  });

  // --- App Download / Install Analytics ---
  const readAnalytics = () => {
    try {
      if (fs.existsSync(ANALYTICS_FILE)) {
        return JSON.parse(fs.readFileSync(ANALYTICS_FILE, 'utf-8'));
      }
    } catch {}
    return { appInstalls: 0, lastInstalledAt: 0 };
  };

  const writeAnalytics = (data: any) => {
    try {
      fs.writeFileSync(ANALYTICS_FILE, JSON.stringify(data, null, 2), 'utf-8');
    } catch {}
  };

  app.post('/api/analytics/app-install', (req, res) => {
    const data = readAnalytics();
    data.appInstalls = (data.appInstalls || 0) + 1;
    data.lastInstalledAt = Date.now();
    writeAnalytics(data);

    try {
      fetch('https://himrw-fae65-default-rtdb.firebaseio.com/analytics/appInstalls.json', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data.appInstalls)
      }).catch(() => {});
    } catch {}

    res.json({ success: true, count: data.appInstalls });
  });

  app.get('/api/analytics/stats', (req, res) => {
    const data = readAnalytics();
    res.json({ success: true, stats: data });
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
