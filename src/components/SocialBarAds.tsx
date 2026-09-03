import React, { useEffect, useMemo, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useAds } from '../hooks/useAds';

interface ParsedScript {
  src?: string;
  code?: string;
  type?: string;
}

function parseScriptString(raw: string): ParsedScript[] {
  const trimmed = raw.trim();
  if (!trimmed) return [];

  // Check if it contains <script> tags
  if (trimmed.includes('<script')) {
    const results: ParsedScript[] = [];
    const div = document.createElement('div');
    div.innerHTML = trimmed;
    const scriptTags = div.querySelectorAll('script');
    scriptTags.forEach((s) => {
      const src = s.getAttribute('src');
      const code = s.textContent || '';
      const type = s.getAttribute('type') || 'text/javascript';
      if (src || code.trim()) {
        results.push({ src: src || undefined, code: code.trim() || undefined, type });
      }
    });
    return results;
  }

  // If it's a bare URL (e.g. https://... or //...)
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('//')) {
    return [{ src: trimmed, type: 'text/javascript' }];
  }

  // Otherwise treat as raw inline JavaScript
  return [{ code: trimmed, type: 'text/javascript' }];
}

export function SocialBarAds() {
  const { socialBars } = useAds();
  const { pathname } = useLocation();
  const isVideoRoute = pathname.startsWith('/video');
  const isAdminRoute = pathname.startsWith('/erfan') || pathname.startsWith('/admin');

  // Filter active social bars
  const activeSocialBars = useMemo(() => {
    return socialBars.filter((ad) => ad.status === 'on' && ad.script?.trim());
  }, [socialBars]);

  // Create a serialized string signature so effect only triggers when actual ads change or route changes
  const signature = useMemo(() => {
    return `${isVideoRoute ? 'video' : 'other'}:${activeSocialBars.map((a) => `${a.id}:${a.script}`).join('||')}`;
  }, [isVideoRoute, activeSocialBars]);

  const injectedElementsRef = useRef<HTMLElement[]>([]);

  useEffect(() => {
    // CRITICAL: Strict ad-free guarantee for admin routes
    if (isAdminRoute || !isVideoRoute || activeSocialBars.length === 0) {
      // Clean up any previously injected social bar scripts
      injectedElementsRef.current.forEach((el) => el.remove());
      injectedElementsRef.current = [];
      return;
    }

    const currentInjected: HTMLElement[] = [];

    activeSocialBars.forEach((ad) => {
      const parsedList = parseScriptString(ad.script);

      parsedList.forEach((parsed, index) => {
        const uniqueKey = `sb-ad-${ad.id}-${index}`;
        // Check if an identical script tag is already in the document
        const existing = document.querySelector(`[data-socialbar-key="${uniqueKey}"]`);
        if (existing) {
          currentInjected.push(existing as HTMLElement);
          return;
        }

        const scriptEl = document.createElement('script');
        scriptEl.type = parsed.type || 'text/javascript';
        scriptEl.dataset.socialbarKey = uniqueKey;
        scriptEl.dataset.adId = ad.id;
        scriptEl.async = true;

        if (parsed.src) {
          let src = parsed.src;
          if (src.startsWith('//')) {
            src = `https:${src}`;
          }
          scriptEl.src = src;
        }

        if (parsed.code) {
          scriptEl.text = parsed.code;
        }

        try {
          (document.head || document.body).appendChild(scriptEl);
          currentInjected.push(scriptEl);
        } catch (err) {
          console.warn('Failed to inject social bar script:', err);
        }
      });
    });

    injectedElementsRef.current = currentInjected;
  }, [signature, isVideoRoute, isAdminRoute, activeSocialBars]);

  return null;
}


