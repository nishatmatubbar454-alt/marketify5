import express from 'express';
import compression from 'compression';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { createServer as createViteServer } from 'vite';

const portArgIdx = process.argv.indexOf('--port');
const PORT = portArgIdx !== -1 && process.argv[portArgIdx + 1] ? Number(process.argv[portArgIdx + 1]) : 3000;
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

const RTDB_ENDPOINTS = [
  'https://maka-bfd59-default-rtdb.firebaseio.com',
  'https://himrw-fae65-default-rtdb.firebaseio.com'
];

let serverReadCounter = 0;
function getBalancedEndpoints(subpath: string = '') {
  const p = subpath.startsWith('/') ? subpath : `/${subpath}`;
  const pickFirst = (serverReadCounter++) % 2 === 0;
  return [
    `${RTDB_ENDPOINTS[pickFirst ? 0 : 1]}${p}`,
    `${RTDB_ENDPOINTS[pickFirst ? 1 : 0]}${p}`
  ];
}

let lastFirebaseSyncError = 0;
const FIREBASE_RETRY_COOLDOWN = 30000;

async function syncFromFirebase() {
  if (Date.now() - lastFirebaseSyncError < FIREBASE_RETRY_COOLDOWN) {
    return readVideos();
  }

  const [url1, url2] = getBalancedEndpoints('/videos.json');

  // Try url1, failover to url2
  for (const url of [url1, url2]) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);

      const res = await fetch(url, {
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
      // Continue to next endpoint on error
    }
  }

  lastFirebaseSyncError = Date.now();
  return readVideos();
}

async function syncToFirebase(videoId: string, videoObj: any) {
  if (!videoObj || (!videoObj.embedUrl && !videoObj.websiteUrl)) return;
  const body = JSON.stringify(videoObj);

  // Dual-Write to BOTH Firebase RTDB instances concurrently
  await Promise.allSettled(
    RTDB_ENDPOINTS.map(async (base) => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4000);
        await fetch(`${base}/videos/${encodeURIComponent(videoId)}.json`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body,
          signal: controller.signal
        }).finally(() => clearTimeout(timeoutId));
      } catch {}
    })
  );
}

async function deleteFromFirebase(videoId: string) {
  // Dual-Delete from BOTH Firebase RTDB instances concurrently
  await Promise.allSettled(
    RTDB_ENDPOINTS.map(async (base) => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        await fetch(`${base}/videos/${encodeURIComponent(videoId)}.json`, {
          method: 'DELETE',
          signal: controller.signal
        }).finally(() => clearTimeout(timeoutId));
      } catch {}
    })
  );
}

async function syncAdsFromFirebase() {
  if (Date.now() - lastFirebaseSyncError < FIREBASE_RETRY_COOLDOWN) {
    return readAds();
  }

  const [url1, url2] = getBalancedEndpoints('/ads.json');

  for (const url of [url1, url2]) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);

      const res = await fetch(url, {
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
    } catch {}
  }

  return readAds();
}

async function syncAdToFirebase(adId: string, adObj: any) {
  const body = JSON.stringify(adObj);
  // Dual-write ads to BOTH Firebase RTDB instances
  await Promise.allSettled(
    RTDB_ENDPOINTS.map(async (base) => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);
        await fetch(`${base}/ads/${encodeURIComponent(adId)}.json`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body,
          signal: controller.signal
        }).finally(() => clearTimeout(timeoutId));
      } catch {}
    })
  );
}

async function deleteAdFromFirebase(adId: string) {
  // Dual-delete ads from BOTH Firebase RTDB instances
  await Promise.allSettled(
    RTDB_ENDPOINTS.map(async (base) => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);
        await fetch(`${base}/ads/${encodeURIComponent(adId)}.json`, {
          method: 'DELETE',
          signal: controller.signal
        }).finally(() => clearTimeout(timeoutId));
      } catch {}
    })
  );
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

  // --- Security Headers Middleware ---
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });

  // --- API Rate Limiter (Protects against DDoS, Brute Force & Scraping) ---
  const ipRequestCounts = new Map<string, { count: number; resetAt: number }>();
  app.use('/api', (req, res, next) => {
    const rawIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    const entry = ipRequestCounts.get(rawIp) || { count: 0, resetAt: now + 60000 };
    if (now > entry.resetAt) {
      entry.count = 0;
      entry.resetAt = now + 60000;
    }
    entry.count++;
    ipRequestCounts.set(rawIp, entry);
    if (entry.count > 300) {
      return res.status(429).json({ success: false, error: 'Too many requests. Please slow down.' });
    }
    next();
  });

  // Periodic rate limiter memory cleanup
  setInterval(() => {
    const now = Date.now();
    for (const [k, v] of ipRequestCounts.entries()) {
      if (now > v.resetAt) ipRequestCounts.delete(k);
    }
  }, 120000);

  // --- Admin Security & Cryptographic Auth State ---
  const readAuthConfig = () => {
    try {
      if (fs.existsSync(AUTH_FILE)) {
        return JSON.parse(fs.readFileSync(AUTH_FILE, 'utf-8'));
      }
    } catch {}
    const fallback = {
      salt: 'mk_sec_7459ded438aa25c4',
      hash: '8cb9c52c2824bdf301e10be312b2e87b15d331d996b260b6b2fd981beaf1be26',
      altHash: '9164831126f1d9b53d5082619d12718cfc092a3e70c9943fe8ee63f461c417ae',
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

  // Timing-safe password verification (supports 44566N, 445566N, uppercase/lowercase and single/double-5 typo variations)
  const verifyPassHash = (password: string): boolean => {
    const authConfig = readAuthConfig();
    const clean = (password || '').trim();
    if (!clean) return false;

    const rawVariants = [clean, clean.toUpperCase(), clean.toLowerCase()];
    const variants = new Set<string>();
    for (const v of rawVariants) {
      variants.add(v);
      if (v.includes('44566')) variants.add(v.replace('44566', '445566'));
      if (v.includes('445566')) variants.add(v.replace('445566', '44566'));
    }

    const targetHashes = [authConfig.hash, authConfig.altHash].filter(Boolean) as string[];

    for (const cand of Array.from(variants)) {
      const computedHash = crypto
        .pbkdf2Sync(cand, authConfig.salt, authConfig.iterations || 100000, 32, 'sha256')
        .toString('hex');
      const computedBuf = Buffer.from(computedHash, 'hex');

      for (const tHash of targetHashes) {
        const storedBuf = Buffer.from(tHash, 'hex');
        if (storedBuf.length === computedBuf.length && crypto.timingSafeEqual(storedBuf, computedBuf)) {
          return true;
        }
      }
    }
    return false;
  };

  // Strict Admin Authorization Middleware
  function requireAdminAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim() || (req.headers['x-admin-token'] as string);
    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'প্রবেশাধিকার সংরক্ষিত: এডমিন প্রমাণীকরণ আবশ্যক (Unauthorized access. Valid admin token required).'
      });
    }
    const sessions = readSessions();
    const session = sessions[token];
    if (!session || session.role !== 'admin' || session.expiresAt <= Date.now()) {
      return res.status(401).json({
        success: false,
        error: 'সেশন মেয়াদোত্তীর্ণ বা অবৈধ। দয়া করে পুনরায় লগইন করুন।'
      });
    }
    (req as any).adminSession = session;
    next();
  }

  // Safe URL scheme verification (guards against XSS pseudo-protocols)
  function isSafeUrl(url: any): boolean {
    if (typeof url !== 'string') return false;
    const trimmed = url.trim();
    if (!trimmed) return false;
    if (/^(javascript:|data:|vbscript:)/i.test(trimmed)) return false;
    return /^https?:\/\//i.test(trimmed) || /<iframe/i.test(trimmed) || /^\/\//i.test(trimmed);
  }

  // --- Public Read APIs ---
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

  app.get('/api/videos/:id', (req, res) => {
    const { id } = req.params;
    const videos = readVideos();
    const found = videos.find((v: any) => v.id === id);
    if (found) {
      return res.json({ success: true, video: found });
    }
    res.status(404).json({ success: false, error: 'Video not found' });
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

  app.get('/api/admin/dual-status', (_req, res) => {
    res.json({
      success: true,
      activeProjects: [
        { id: 'maka-bfd59', role: 'Primary & Realtime DB', url: RTDB_ENDPOINTS[0] },
        { id: 'himrw-fae65', role: 'Secondary Load Balancer & Backup', url: RTDB_ENDPOINTS[1] }
      ],
      loadBalancing: '50/50 Round-Robin & Instant Failover',
      replication: 'Active-Active Dual Write'
    });
  });

  // --- Controlled Public Views / Likes Bump (Rate-Limited & Validated) ---
  const bumpRateMap = new Map<string, { count: number; resetAt: number }>();
  app.post('/api/videos/:id/bump', (req, res) => {
    const rawIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    const bEntry = bumpRateMap.get(rawIp) || { count: 0, resetAt: now + 60000 };
    if (now > bEntry.resetAt) {
      bEntry.count = 0;
      bEntry.resetAt = now + 60000;
    }
    bEntry.count++;
    bumpRateMap.set(rawIp, bEntry);
    if (bEntry.count > 60) {
      return res.status(429).json({ success: false, error: 'Rate limit exceeded for views/likes' });
    }

    const { id } = req.params;
    let { field, by = 1 } = req.body || {};
    by = Number(by);
    if (isNaN(by) || by < 1 || by > 5) by = 1;

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

  // --- Admin Authentication Endpoints ---
  app.post('/api/auth/login', (req, res) => {
    const rawIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    const attempt = loginAttempts.get(rawIp) || { count: 0, lockedUntil: 0 };

    const { password } = req.body || {};
    if (!password || typeof password !== 'string') {
      return res.status(400).json({ success: false, error: 'Password is required' });
    }

    const isValid = verifyPassHash(password);
    if (!isValid) {
      if (attempt.lockedUntil > now) {
        const remainingMinutes = Math.ceil((attempt.lockedUntil - now) / 60000);
        return res.status(429).json({
          success: false,
          error: `অত্যধিক ভুল চেষ্টার কারণে একাউন্ট সাময়িকভাবে লক হয়েছে। অনুগ্রহ করে ${remainingMinutes} মিনিট পর আবার চেষ্টা করুন।`
        });
      }

      attempt.count += 1;
      if (attempt.count >= 5) {
        attempt.lockedUntil = now + 15 * 60 * 1000;
        attempt.count = 0;
      }
      loginAttempts.set(rawIp, attempt);
      return setTimeout(() => {
        res.status(401).json({ success: false, error: 'ভুল পাসওয়ার্ড! অ্যাক্সেস প্রত্যাখ্যাত।' });
      }, 350);
    }

    // Correct password provided - clear lock completely
    loginAttempts.delete(rawIp);

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

  app.post('/api/auth/change-password', requireAdminAuth, (req, res) => {
    const authHeader = req.headers.authorization || '';
    const currentToken = authHeader.replace(/^Bearer\s+/i, '').trim();
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

    // Invalidate all other sessions for security; keep only current token
    const sessions = readSessions();
    const updatedSessions: Record<string, any> = {};
    if (currentToken && sessions[currentToken]) {
      updatedSessions[currentToken] = sessions[currentToken];
    }
    writeSessions(updatedSessions);

    res.json({ success: true, message: 'পাসওয়ার্ড সফলভাবে ইনক্রিপ্ট করে আপডেট করা হয়েছে।' });
  });

  // --- Protected Admin Mutation APIs (requireAdminAuth) ---
  app.post('/api/videos', requireAdminAuth, (req, res) => {
    const payload = req.body;
    const hasEmbed = payload && typeof payload.embedUrl === 'string' && payload.embedUrl.trim().length > 0;
    const hasWebsite = payload && typeof payload.websiteUrl === 'string' && payload.websiteUrl.trim().length > 0;
    if (!payload || (!hasEmbed && !hasWebsite)) {
      return res.status(400).json({ success: false, error: 'embedUrl or websiteUrl is required' });
    }

    if (hasEmbed && !isSafeUrl(payload.embedUrl)) {
      return res.status(400).json({ success: false, error: 'Invalid or unsafe embed URL scheme.' });
    }
    if (hasWebsite && !isSafeUrl(payload.websiteUrl)) {
      return res.status(400).json({ success: false, error: 'Invalid or unsafe website URL scheme.' });
    }
    if (payload.thumbnailUrl && !isSafeUrl(payload.thumbnailUrl)) {
      return res.status(400).json({ success: false, error: 'Invalid or unsafe thumbnail URL scheme.' });
    }

    const videos = readVideos();
    const now = Date.now();
    const rawId = typeof payload.id === 'string' && !payload.id.includes('/') && !payload.id.includes('..') ? payload.id.trim() : '';
    const id = rawId || `vid_${now}_${Math.random().toString(36).substring(2, 7)}`;
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

  const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

  // Soft Delete / Recycle Bin & 30-day Immortality Protection (Admin Protected)
  app.delete('/api/videos/:id', requireAdminAuth, (req, res) => {
    const { id } = req.params;
    const videos = readVideos();
    const target = videos.find((v: any) => v.id === id);

    if (!target) {
      return res.status(404).json({ success: false, error: 'Video not found' });
    }

    const createdTime = target.createdAt || target.updatedAt || 0;
    const ageMs = Date.now() - createdTime;

    // Strict 30-day permanent lock rule
    if (ageMs > THIRTY_DAYS_MS) {
      return res.status(403).json({
        success: false,
        locked: true,
        error: 'নিরাপত্তা সুরক্ষা: এই ভিডিওটি যোগ করার পর ৩০ দিন অতিক্রান্ত হয়েছে। এটি চিরস্থায়ী হয়ে গেছে এবং ফায়ারবেস/ডাটাবেজ থেকে ডিলিট করা নিষিদ্ধ।'
      });
    }

    // Soft delete to Recycle Bin - physical Firebase data is preserved, never destroyed
    target.status = 'trashed';
    target.deletedAt = Date.now();
    target.updatedAt = Date.now();

    writeVideos(videos);
    syncToFirebase(id, target);
    res.json({ success: true, message: 'Moved to 30-day Recycle Bin', video: target });
  });

  app.post('/api/videos/:id/trash', requireAdminAuth, (req, res) => {
    const { id } = req.params;
    const { deletedAt = Date.now() } = req.body || {};
    const videos = readVideos();
    const target = videos.find((v: any) => v.id === id);

    if (!target) {
      return res.status(404).json({ success: false, error: 'Video not found' });
    }

    const createdTime = target.createdAt || target.updatedAt || 0;
    if (Date.now() - createdTime > THIRTY_DAYS_MS) {
      return res.status(403).json({
        success: false,
        locked: true,
        error: 'Permanent lock active: Video is older than 30 days.'
      });
    }

    target.status = 'trashed';
    target.deletedAt = deletedAt;
    target.updatedAt = Date.now();

    writeVideos(videos);
    syncToFirebase(id, target);
    res.json({ success: true, message: 'Video moved to Recycle Bin', video: target });
  });

  app.post('/api/videos/:id/restore', requireAdminAuth, (req, res) => {
    const { id } = req.params;
    const videos = readVideos();
    const target = videos.find((v: any) => v.id === id);

    if (!target) {
      return res.status(404).json({ success: false, error: 'Video not found' });
    }

    target.status = 'active';
    delete target.deletedAt;
    target.updatedAt = Date.now();

    writeVideos(videos);
    syncToFirebase(id, target);
    res.json({ success: true, message: 'Video restored from Recycle Bin', video: target });
  });

  app.post('/api/ads', requireAdminAuth, (req, res) => {
    const ad = req.body;
    if (!ad || !ad.id) {
      return res.status(400).json({ success: false, error: 'Ad with id is required' });
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

  app.delete('/api/ads/:id', requireAdminAuth, (req, res) => {
    const { id } = req.params;
    const ads = readAds().filter((a: any) => a.id !== id);
    writeAds(ads);
    deleteAdFromFirebase(id);
    res.json({ success: true });
  });

  // --- Dual Firebase Sync & Status API (Admin Protected) ---
  app.post('/api/admin/dual-sync', requireAdminAuth, async (_req, res) => {
    try {
      const videos = readVideos();
      const ads = readAds();

      // Ensure both Firebase instances receive the complete video & ads state
      const videoMap: Record<string, any> = {};
      videos.forEach((v: any) => {
        if (v && v.id) videoMap[v.id] = v;
      });

      const adsMap: Record<string, any> = {};
      ads.forEach((a: any) => {
        if (a && a.id) adsMap[a.id] = a;
      });

      const results = await Promise.allSettled(
        RTDB_ENDPOINTS.map(async (endpoint) => {
          const vRes = await fetch(`${endpoint}/videos.json`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(videoMap)
          });
          const aRes = await fetch(`${endpoint}/ads.json`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(adsMap)
          });
          return { endpoint, videosOk: vRes.ok, adsOk: aRes.ok };
        })
      );

      res.json({
        success: true,
        message: 'Dual Firebase synchronization completed successfully',
        syncedVideos: videos.length,
        syncedAds: ads.length,
        endpoints: RTDB_ENDPOINTS,
        results
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: 'Internal server error during synchronization' });
    }
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
      RTDB_ENDPOINTS.forEach((endpoint) => {
        fetch(`${endpoint}/analytics/appInstalls.json`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data.appInstalls)
        }).catch(() => {});
      });
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
