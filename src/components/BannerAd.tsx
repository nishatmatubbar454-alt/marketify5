import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAds } from '../hooks/useAds';

let globalBannerSlotCounter = 0;

interface DetectedDimensions {
  width: number | null;
  height: number | null;
}

function detectAdDimensions(raw: string): DetectedDimensions {
  let width: number | null = null;
  let height: number | null = null;

  const wMatch =
    raw.match(/['"]?width['"]?\s*[:=]\s*['"]?(\d{2,4})/i) ||
    raw.match(/\bwidth\s*=\s*['"]?(\d{2,4})/i);
  const hMatch =
    raw.match(/['"]?height['"]?\s*[:=]\s*['"]?(\d{2,4})/i) ||
    raw.match(/\bheight\s*=\s*['"]?(\d{2,4})/i);

  if (wMatch) width = Number(wMatch[1]);
  if (hMatch) height = Number(hMatch[1]);

  return { width, height };
}

function isImageUrl(url: string): boolean {
  const clean = url.toLowerCase().split('?')[0].split('#')[0];
  return /\.(png|jpe?g|gif|webp|svg|avif)$/.test(clean);
}

function isLikelyJsUrl(url: string): boolean {
  const clean = url.toLowerCase().split('?')[0];
  return (
    clean.endsWith('.js') ||
    clean.endsWith('.mjs') ||
    clean.includes('invoke.js') ||
    clean.includes('tag.min.js') ||
    clean.includes('brijmohan.org')
  );
}

function buildAdBodyMarkup(raw: string, widthHint: number | null, heightHint: number | null): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';

  // Case 1: Contains HTML / <script> / <iframe> / <div> / <a> / <img>
  if (trimmed.includes('<')) {
    return trimmed;
  }

  // Case 2: Bare URL
  if (/^(https?:)?\/\/[^\s<>"']+$/i.test(trimmed)) {
    const url = trimmed.startsWith('//') ? `https:${trimmed}` : trimmed;
    if (isImageUrl(url)) {
      return `<img src="${url}" alt="Sponsored" style="max-width:100%;height:auto;display:block;margin:0 auto;border-radius:4px;" />`;
    }
    if (isLikelyJsUrl(url)) {
      return `<script data-cfasync="false" src="${url}"></script>`;
    }
    // Generic Direct / Ad URL pasted into a banner slot: render safely inside framed view + clickable fallback
    const w = widthHint ? `${widthHint}px` : '100%';
    const h = heightHint ? `${heightHint}px` : '90px';
    return `<iframe src="${url}" style="width:${w};max-width:100%;height:${h};border:0;overflow:hidden;" loading="eager" referrerpolicy="no-referrer-when-downgrade"></iframe>`;
  }

  // Case 3: Bare JS snippet without <script> wrapper
  return `<script>${trimmed}</script>`;
}

export const BannerAd = React.memo(function BannerAd({ slot }: { slot?: number }) {
  const { banners } = useAds();
  const { pathname } = useLocation();
  const containerRef = useRef<HTMLDivElement>(null);
  const instanceToken = useId();
  const autoSlotRef = useRef<number | null>(null);
  if (autoSlotRef.current === null) {
    autoSlotRef.current = globalBannerSlotCounter++;
  }

  // CRITICAL: Never render banner ads inside Admin Panel
  const isAdminRoute = pathname.startsWith('/admin') || pathname.startsWith('/erfan');

  const assignedAd = useMemo(() => {
    if (isAdminRoute || banners.length === 0) return undefined;
    const idx = (slot !== undefined ? slot : autoSlotRef.current!) % banners.length;
    return banners[idx];
  }, [isAdminRoute, banners, slot]);

  const dims = useMemo(() => {
    return assignedAd?.script ? detectAdDimensions(assignedAd.script) : { width: null, height: null };
  }, [assignedAd?.script]);

  const initialHeight = dims.height && dims.height >= 40 && dims.height <= 600 ? dims.height : 60;
  const maxBoxWidth = dims.width && dims.width >= 200 && dims.width <= 970 ? dims.width : 728;
  const [frameHeight, setFrameHeight] = useState<number>(initialHeight);

  useEffect(() => {
    setFrameHeight(initialHeight);
  }, [initialHeight, assignedAd?.id, assignedAd?.script]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const data = event.data;
      if (
        data &&
        typeof data === 'object' &&
        data.type === 'mk-banner-resize' &&
        data.token === instanceToken &&
        typeof data.height === 'number' &&
        data.height >= 40
      ) {
        const clamped = Math.min(600, Math.max(50, Math.ceil(data.height)));
        setFrameHeight(clamped);
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [instanceToken]);

  const isEnabled = !isAdminRoute && assignedAd?.status === 'on' && Boolean(assignedAd?.script?.trim());

  useEffect(() => {
    if (!isEnabled || !assignedAd?.script) return;
    const container = containerRef.current;
    if (!container) return;

    container.innerHTML = '';

    const iframe = document.createElement('iframe');
    iframe.style.width = '100%';
    iframe.style.maxWidth = `${maxBoxWidth}px`;
    iframe.style.height = `${initialHeight}px`;
    iframe.style.border = '0';
    iframe.style.overflow = 'hidden';
    iframe.scrolling = 'no';
    iframe.title = assignedAd.name || 'Advertisement';
    iframe.setAttribute('allow', 'autoplay');
    iframe.setAttribute('loading', 'eager');

    container.appendChild(iframe);

    const bodyMarkup = buildAdBodyMarkup(assignedAd.script, dims.width, dims.height);
    const safeToken = JSON.stringify(instanceToken);

    const htmlContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <script>
    window.onerror = function() { return true; };
    window.addEventListener('error', function(e) { e.preventDefault(); }, true);
  </script>
  <style>
    html, body {
      margin: 0;
      padding: 0;
      overflow: hidden;
      background: transparent;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      width: 100%;
      min-height: ${initialHeight}px;
    }
    img, iframe {
      max-width: 100%;
    }
  </style>
</head>
<body>
  ${bodyMarkup}
  <script>
    (function() {
      var token = ${safeToken};
      var lastH = 0;
      function reportHeight() {
        try {
          var h = Math.max(
            document.body ? document.body.scrollHeight : 0,
            document.documentElement ? document.documentElement.scrollHeight : 0
          );
          if (h > 40 && h !== lastH) {
            lastH = h;
            window.parent.postMessage({ type: 'mk-banner-resize', token: token, height: h }, '*');
          }
        } catch (e) {}
      }
      window.addEventListener('load', reportHeight);
      if (typeof ResizeObserver !== 'undefined' && document.body) {
        new ResizeObserver(reportHeight).observe(document.body);
      }
      if (typeof MutationObserver !== 'undefined' && document.body) {
        new MutationObserver(reportHeight).observe(document.body, { childList: true, subtree: true });
      }
      var ticks = 0;
      var timer = setInterval(function() {
        reportHeight();
        if (++ticks > 20) clearInterval(timer);
      }, 400);
    })();
  </script>
</body>
</html>`;

    try {
      const doc = iframe.contentWindow?.document || iframe.contentDocument;
      if (doc) {
        doc.open();
        doc.write(htmlContent);
        doc.close();
      } else {
        iframe.srcdoc = htmlContent;
      }
    } catch {
      iframe.srcdoc = htmlContent;
    }
  }, [assignedAd?.id, assignedAd?.script, assignedAd?.status, assignedAd?.updatedAt, isEnabled, initialHeight, maxBoxWidth, dims.width, dims.height, instanceToken]);

  useEffect(() => {
    const iframe = containerRef.current?.querySelector('iframe');
    if (iframe) {
      iframe.style.height = `${frameHeight}px`;
    }
  }, [frameHeight]);

  if (!isEnabled) return null;

  return (
    <div className="w-full overflow-hidden flex justify-center my-1">
      <div
        ref={containerRef}
        style={{ maxWidth: `${maxBoxWidth}px`, minHeight: `${frameHeight}px` }}
        className="w-full overflow-hidden rounded flex justify-center items-center bg-transparent"
      />
    </div>
  );
});
