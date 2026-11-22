import { useEffect, useMemo, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useAds } from '../hooks/useAds';

interface ParsedScriptNode {
  attrs: Record<string, string>;
  code?: string;
}

interface ParsedAdSnippet {
  scripts: ParsedScriptNode[];
  htmlNodesMarkup: string;
  directLinkUrl?: string;
}

function hashString(input: string): string {
  let hash = 5381;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) + hash + input.charCodeAt(i)) | 0;
  }
  return (hash >>> 0).toString(36);
}

function isLikelyJsUrl(url: string): boolean {
  const lower = url.toLowerCase().split('?')[0];
  return (
    lower.endsWith('.js') ||
    lower.endsWith('.mjs') ||
    lower.includes('tag.min.js') ||
    lower.includes('invoke.js') ||
    lower.includes('brijmohan.org')
  );
}

function parseAdSnippet(raw: string): ParsedAdSnippet {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { scripts: [], htmlNodesMarkup: '' };
  }

  // Case 1: Contains HTML / <script> / <ins> / <div> / <a> / <iframe>
  if (trimmed.includes('<')) {
    const scripts: ParsedScriptNode[] = [];
    const wrapper = document.createElement('div');
    wrapper.innerHTML = trimmed;

    const scriptTags = Array.from(wrapper.querySelectorAll('script'));
    scriptTags.forEach((s) => {
      const attrs: Record<string, string> = {};
      Array.from(s.attributes).forEach((attr) => {
        attrs[attr.name] = attr.value;
      });
      const code = (s.textContent || '').trim();
      if (attrs.src || code) {
        scripts.push({ attrs, code: code || undefined });
      }
      s.remove();
    });

    const htmlNodesMarkup = wrapper.innerHTML.trim();
    return { scripts, htmlNodesMarkup };
  }

  // Case 2: Bare URL (either a JS tag URL or a Direct Link / Popunder URL)
  if (/^(https?:)?\/\/[^\s<>"']+$/i.test(trimmed)) {
    const normalizedUrl = trimmed.startsWith('//') ? `https:${trimmed}` : trimmed;
    if (isLikelyJsUrl(normalizedUrl)) {
      return {
        scripts: [{ attrs: { src: normalizedUrl, async: 'true', 'data-cfasync': 'false' } }],
        htmlNodesMarkup: ''
      };
    }
    // Non-.js bare URL (e.g., Monetag/Adsterra Direct Link like https://arwf.org/4/...)
    // Load as script in case it's cloaked JS, AND also register clean click-trigger direct link support
    return {
      scripts: [{ attrs: { src: normalizedUrl, async: 'true', 'data-cfasync': 'false' } }],
      htmlNodesMarkup: '',
      directLinkUrl: normalizedUrl
    };
  }

  // Case 3: Raw inline JavaScript (without <script> tags)
  return {
    scripts: [{ attrs: { type: 'text/javascript' }, code: trimmed }],
    htmlNodesMarkup: ''
  };
}

export function SocialBarAds() {
  const { socialBars } = useAds();
  const { pathname } = useLocation();
  // STRICT: Only disable ads on Admin routes (/erfan*, /admin*). Run on ALL public routes including Home ('/').
  const isAdminRoute = pathname.startsWith('/erfan') || pathname.startsWith('/admin');

  const activeSocialBars = useMemo(() => {
    return socialBars.filter((ad) => ad.status === 'on' && Boolean(ad.script?.trim()));
  }, [socialBars]);

  const signature = useMemo(() => {
    if (isAdminRoute) return 'blocked-admin';
    return activeSocialBars
      .map((a) => `${a.id}:${hashString(a.script || '')}`)
      .join('||');
  }, [isAdminRoute, activeSocialBars]);

  const injectedNodesRef = useRef<Map<string, HTMLElement[]>>(new Map());
  const directLinksRef = useRef<string[]>([]);

  useEffect(() => {
    const HOST_ID = 'mk-global-ad-host';

    if (isAdminRoute || activeSocialBars.length === 0) {
      // Remove all injected elements when entering Admin Panel or when all ads are off
      injectedNodesRef.current.forEach((nodes) => {
        nodes.forEach((el) => el.remove());
      });
      injectedNodesRef.current.clear();
      directLinksRef.current = [];
      const host = document.getElementById(HOST_ID);
      if (host) host.remove();
      return;
    }

    const desiredKeys = new Set<string>();
    const activeDirectLinks: string[] = [];

    // Ensure a non-React host container exists for non-script HTML ad containers (e.g., <div id="container-...">)
    let htmlHost = document.getElementById(HOST_ID);
    if (!htmlHost) {
      htmlHost = document.createElement('div');
      htmlHost.id = HOST_ID;
      htmlHost.style.display = 'contents';
      document.body.appendChild(htmlHost);
    }

    activeSocialBars.forEach((ad) => {
      const parsed = parseAdSnippet(ad.script);
      const adHash = hashString(ad.script);

      if (parsed.directLinkUrl) {
        activeDirectLinks.push(parsed.directLinkUrl);
      }

      // 1. Mount any HTML container nodes BEFORE running scripts that reference them
      if (parsed.htmlNodesMarkup) {
        const htmlKey = `sb-html-${ad.id}-${adHash}`;
        desiredKeys.add(htmlKey);
        if (!injectedNodesRef.current.has(htmlKey)) {
          const box = document.createElement('div');
          box.dataset.socialbarKey = htmlKey;
          box.dataset.adId = ad.id;
          box.innerHTML = parsed.htmlNodesMarkup;
          htmlHost!.appendChild(box);
          injectedNodesRef.current.set(htmlKey, [box]);
        }
      }

      // 2. Mount all <script> tags preserving all custom attributes (data-zone, data-cfasync, etc.)
      parsed.scripts.forEach((scriptNode, index) => {
        const uniqueKey = `sb-js-${ad.id}-${index}-${adHash}`;
        desiredKeys.add(uniqueKey);

        if (injectedNodesRef.current.has(uniqueKey)) {
          return;
        }
        const existingInDom = document.querySelector(`[data-socialbar-key="${uniqueKey}"]`) as HTMLElement | null;
        if (existingInDom) {
          injectedNodesRef.current.set(uniqueKey, [existingInDom]);
          return;
        }

        const scriptEl = document.createElement('script');
        Object.entries(scriptNode.attrs).forEach(([attrName, attrVal]) => {
          if (attrName.toLowerCase() === 'src') {
            const normalizedSrc = attrVal.startsWith('//') ? `https:${attrVal}` : attrVal;
            scriptEl.setAttribute('src', normalizedSrc);
          } else {
            scriptEl.setAttribute(attrName, attrVal);
          }
        });

        if (!scriptEl.type) {
          scriptEl.type = 'text/javascript';
        }
        scriptEl.dataset.socialbarKey = uniqueKey;
        scriptEl.dataset.adId = ad.id;

        if (scriptNode.code) {
          scriptEl.text = scriptNode.code;
        }

        scriptEl.onerror = () => {
          // Suppress third-party ad network load errors silently
        };

        try {
          (document.body || document.head).appendChild(scriptEl);
          injectedNodesRef.current.set(uniqueKey, [scriptEl]);
        } catch {
          // Fail gracefully
        }
      });
    });

    // Clean up stale / edited / disabled ad nodes
    for (const [key, nodes] of injectedNodesRef.current.entries()) {
      if (!desiredKeys.has(key)) {
        nodes.forEach((el) => el.remove());
        injectedNodesRef.current.delete(key);
      }
    }

    directLinksRef.current = activeDirectLinks;
  }, [signature, isAdminRoute, activeSocialBars]);

  // Direct Link Popunder support for bare non-.js ad URLs (e.g. https://arwf.org/4/...)
  useEffect(() => {
    if (isAdminRoute || directLinksRef.current.length === 0) return;

    const COOLDOWN_MS = 45000;
    const STORAGE_KEY = 'mk-direct-ad-last';

    const handlePublicClick = (e: MouseEvent) => {
      const links = directLinksRef.current;
      if (!links.length) return;

      // Never hijack admin links or interactive buttons inside header/nav/player controls unless normal browse tap
      const target = e.target as HTMLElement | null;
      if (!target) return;
      if (target.closest('[data-no-popunder="true"]')) return;

      try {
        const last = Number(sessionStorage.getItem(STORAGE_KEY) || '0');
        if (Date.now() - last < COOLDOWN_MS) return;

        const idx = Number(sessionStorage.getItem(`${STORAGE_KEY}-idx`) || '0') % links.length;
        const url = links[idx];
        sessionStorage.setItem(STORAGE_KEY, String(Date.now()));
        sessionStorage.setItem(`${STORAGE_KEY}-idx`, String(idx + 1));

        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.target = '_blank';
        anchor.rel = 'noopener noreferrer';
        anchor.style.display = 'none';
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
      } catch {}
    };

    document.addEventListener('click', handlePublicClick, { capture: false });
    return () => {
      document.removeEventListener('click', handlePublicClick, { capture: false });
    };
  }, [signature, isAdminRoute]);

  return null;
}
