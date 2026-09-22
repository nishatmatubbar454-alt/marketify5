import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Header } from '../components/Header';
import { BannerAd } from '../components/BannerAd';
import { VideoCard } from '../components/VideoCard';
import { useVideos } from '../hooks/useVideos';
import { getHistory } from '../utils/helpers';

export function Home() {
  const { videos, loading, error } = useVideos();
  const [searchParams] = useSearchParams();
  const q = (searchParams.get('q') || '').toLowerCase();
  const history = getHistory();
  const historySet = useMemo(() => new Set(history), [history]);
  const [visibleCount, setVisibleCount] = useState(16);
  const observerTargetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setVisibleCount(16);
  }, [q]);

  const list = useMemo(() => {
    const active = videos.filter((v) => v.status === 'active');
    if (!q) {
      // Split into unseen videos and already watched videos
      const unseen = active.filter((v) => !historySet.has(v.id));
      const seen = active.filter((v) => historySet.has(v.id));

      // Sort unseen by newest first
      const sortedUnseen = unseen.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      // Sort seen by history order or creation time (watched videos sent to the bottom)
      const sortedSeen = seen.sort((a, b) => {
        const aHistoryIdx = history.indexOf(a.id);
        const bHistoryIdx = history.indexOf(b.id);
        if (aHistoryIdx !== -1 && bHistoryIdx !== -1) {
          // Recently watched ones further down or in sequence
          return aHistoryIdx - bHistoryIdx;
        }
        return (b.createdAt || 0) - (a.createdAt || 0);
      });

      return [...sortedUnseen, ...sortedSeen];
    }

    const words = q.split(/\s+/).filter(Boolean);
    return active
      .filter((v) => {
        const title = (v.title || '').toLowerCase();
        const source = (v.sourceName || '').toLowerCase();
        if (title.includes(q) || source.includes(q)) return true;
        return words.every((w) => title.includes(w) || source.includes(w));
      })
      .sort((a, b) => {
        const aSeen = historySet.has(a.id);
        const bSeen = historySet.has(b.id);
        if (!aSeen && bSeen) return -1;
        if (aSeen && !bSeen) return 1;

        const aTitle = (a.title || '').toLowerCase();
        const bTitle = (b.title || '').toLowerCase();
        if (aTitle.startsWith(q) && !bTitle.startsWith(q)) return -1;
        if (!aTitle.startsWith(q) && bTitle.startsWith(q)) return 1;
        return (b.createdAt || 0) - (a.createdAt || 0);
      });
  }, [videos, q, historySet, history]);

  const visibleList = useMemo(() => {
    return list.slice(0, visibleCount);
  }, [list, visibleCount]);

  useEffect(() => {
    const target = observerTargetRef.current;
    if (!target) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && visibleCount < list.length) {
          setVisibleCount((prev) => Math.min(prev + 16, list.length));
        }
      },
      { rootMargin: '300px' }
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [visibleCount, list.length]);

  return (
    <div className="min-h-screen w-full bg-white dark:bg-ink">
      <Header />
      <main className="mx-auto w-full max-w-[1100px] px-3 pb-16 pt-3">
        <BannerAd />

        <nav aria-label="Breadcrumb" className="py-3 flex items-center justify-between">
          <Link to="/" className="text-[17px] font-semibold text-[#1a73e8] dark:text-[#8ab4f8]">
            {q ? `সার্চ ফলাফল: "${searchParams.get('q')}" (${list.length})` : 'Home Feed'}
          </Link>
          {q && (
            <Link
              to="/"
              className="text-xs font-semibold text-brand bg-brand/10 hover:bg-brand/20 px-2.5 py-1 rounded-md transition-colors"
            >
              সব ভিডিও দেখুন
            </Link>
          )}
        </nav>

        {error && (
          <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
            Could not load videos: {error}
          </p>
        )}

        {loading && (
          <div className="space-y-6">
            {[0, 1, 2].map((i) => (
              <div key={i} className="animate-pulse">
                <div className="w-full rounded-xl bg-black/10 dark:bg-white/10" style={{ aspectRatio: '16 / 9' }} />
                <div className="mt-3 flex gap-3">
                  <div className="h-10 w-10 rounded-full bg-black/10 dark:bg-white/10" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-full rounded bg-black/10 dark:bg-white/10" />
                    <div className="h-3 w-1/2 rounded bg-black/10 dark:bg-white/10" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && list.length === 0 && !error && (
          <div className="py-16 text-center">
            <p className="text-[15px] text-[#606060] dark:text-white/60">
              {q ? 'No videos matched your search.' : 'No videos published yet.'}
            </p>
            {!q && (
              <Link to="/erfan" className="mt-2 inline-block text-sm font-medium text-brand">
                Add a video from the admin panel
              </Link>
            )}
          </div>
        )}

        <div className="space-y-3">
          {visibleList.map((video, index) => (
            <div key={video.id} className="space-y-1.5">
              <VideoCard video={video} priority={index < 2} />
              <BannerAd />
            </div>
          ))}
        </div>

        {list.length > visibleList.length && (
          <div ref={observerTargetRef} className="py-6 text-center">
            <button
              type="button"
              onClick={() => setVisibleCount((prev) => Math.min(prev + 16, list.length))}
              className="rounded-xl bg-black/5 px-6 py-2.5 text-xs font-semibold text-brand hover:bg-black/10 dark:bg-white/5 dark:hover:bg-white/10 transition-colors"
            >
              আরও ভিডিও দেখুন ({list.length - visibleList.length}টি বাকি)
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
