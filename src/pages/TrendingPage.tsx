import React, { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Header } from '../components/Header';
import { BannerAd } from '../components/BannerAd';
import { VideoCard } from '../components/VideoCard';
import { Pagination } from '../components/Pagination';
import { useVideos } from '../hooks/useVideos';
import { FlameIcon } from 'lucide-react';

const PAGE_SIZE = 16;
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export function TrendingPage() {
  const { videos, loading, error } = useVideos();
  const [searchParams, setSearchParams] = useSearchParams();
  const pageParam = parseInt(searchParams.get('page') || '1', 10);
  const currentPage = isNaN(pageParam) || pageParam < 1 ? 1 : pageParam;

  // 7-day trending calculation: highest views in last 7 days is placed at the very top
  const trendingList = useMemo(() => {
    const now = Date.now();
    const active = videos.filter((v) => v.status === 'active');

    const last7Days = active.filter((v) => {
      const time = v.createdAt || v.updatedAt || 0;
      return (now - time) <= SEVEN_DAYS_MS;
    });

    const older = active.filter((v) => {
      const time = v.createdAt || v.updatedAt || 0;
      return (now - time) > SEVEN_DAYS_MS;
    });

    // Sort last 7-day videos strictly by views descending
    last7Days.sort((a, b) => (b.views || 0) - (a.views || 0));
    // Sort older videos by views descending
    older.sort((a, b) => (b.views || 0) - (a.views || 0));

    // Combine: 7-day top videos strictly first
    return [...last7Days, ...older];
  }, [videos]);

  const totalPages = Math.ceil(trendingList.length / PAGE_SIZE);

  const visibleList = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return trendingList.slice(start, start + PAGE_SIZE);
  }, [trendingList, currentPage]);

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

        <div className="my-3 flex items-center gap-2 border-b border-black/10 pb-3 dark:border-white/10">
          <FlameIcon size={22} className="text-orange-500 fill-orange-500/20" />
          <h1 className="text-[18px] font-bold text-[#0f0f0f] dark:text-white leading-none">
            Trending Videos
          </h1>
        </div>

        {error && (
          <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
            Error: {error}
          </p>
        )}

        {loading && (
          <div className="space-y-6">
            {[0, 1].map((i) => (
              <div key={i} className="animate-pulse">
                <div className="w-full rounded-xl bg-black/10 dark:bg-white/10" style={{ aspectRatio: '16 / 9' }} />
                <div className="mt-3 h-4 w-3/4 rounded bg-black/10 dark:bg-white/10" />
              </div>
            ))}
          </div>
        )}

        {!loading && trendingList.length === 0 && (
          <div className="py-16 text-center">
            <p className="text-[15px] text-[#606060] dark:text-white/60">No trending videos found.</p>
          </div>
        )}

        {/* Video List with Banner Ad after every single video */}
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
          totalItems={trendingList.length}
          pageSize={PAGE_SIZE}
        />
      </main>
    </div>
  );
}
