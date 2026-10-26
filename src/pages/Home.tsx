import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Header } from '../components/Header';
import { BannerAd } from '../components/BannerAd';
import { VideoCard } from '../components/VideoCard';
import { Pagination } from '../components/Pagination';
import { useVideos } from '../hooks/useVideos';
import { getHistory } from '../utils/helpers';

const PAGE_SIZE = 16;

export function Home() {
  const { videos, loading, error } = useVideos();
  const [searchParams, setSearchParams] = useSearchParams();
  const q = (searchParams.get('q') || '').toLowerCase();
  const pageParam = parseInt(searchParams.get('page') || '1', 10);
  const currentPage = isNaN(pageParam) || pageParam < 1 ? 1 : pageParam;

  const [history, setHistory] = useState<string[]>(() => getHistory());
  const historySet = useMemo(() => new Set(history), [history]);

  useEffect(() => {
    const refreshHistory = () => {
      setHistory(getHistory());
    };

    window.addEventListener('mk-history-updated', refreshHistory);
    window.addEventListener('focus', refreshHistory);
    document.addEventListener('visibilitychange', refreshHistory);
    window.addEventListener('storage', refreshHistory);

    return () => {
      window.removeEventListener('mk-history-updated', refreshHistory);
      window.removeEventListener('focus', refreshHistory);
      document.removeEventListener('visibilitychange', refreshHistory);
      window.removeEventListener('storage', refreshHistory);
    };
  }, []);

  useEffect(() => {
    if (searchParams.has('page')) {
      const next = new URLSearchParams(searchParams);
      next.delete('page');
      setSearchParams(next);
    }
  }, [q]);

  const list = useMemo(() => {
    const active = videos.filter((v) => v.status === 'active');
    if (!q) {
      // Split into unseen videos and already watched videos
      const unseen = active.filter((v) => !historySet.has(v.id));
      const seen = active.filter((v) => historySet.has(v.id));

      // Sort unseen by newest first
      const sortedUnseen = [...unseen].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

      // Sort seen so that recently watched videos are sent to the very bottom
      const sortedSeen = [...seen].sort((a, b) => {
        const aHistoryIdx = history.indexOf(a.id);
        const bHistoryIdx = history.indexOf(b.id);
        if (aHistoryIdx !== -1 && bHistoryIdx !== -1) {
          return bHistoryIdx - aHistoryIdx;
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

  const totalPages = Math.ceil(list.length / PAGE_SIZE);

  const visibleList = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return list.slice(start, start + PAGE_SIZE);
  }, [list, currentPage]);

  const handlePageChange = (p: number) => {
    const nextParams = new URLSearchParams(searchParams);
    if (p <= 1) {
      nextParams.delete('page');
    } else {
      nextParams.set('page', String(p));
    }
    setSearchParams(nextParams);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen w-full bg-white dark:bg-ink">
      <Header />
      <main className="mx-auto w-full max-w-[1100px] px-3 pb-28 sm:pb-32 pt-3">
        <BannerAd />

        <nav aria-label="Breadcrumb" className="py-3 flex items-center justify-between">
          <Link to="/" className="text-[17px] font-bold text-[#0f0f0f] dark:text-white">
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

        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={handlePageChange}
          totalItems={list.length}
          pageSize={PAGE_SIZE}
        />
      </main>
    </div>
  );
}
