import React from 'react';
import { Header } from '../components/Header';
import { BannerAd } from '../components/BannerAd';
import { VideoCard } from '../components/VideoCard';
import { useVideos } from '../hooks/useVideos';
import { FlameIcon } from 'lucide-react';

export function TrendingPage() {
  const { videos, loading, error } = useVideos();
  const trendingList = [...videos]
    .filter((v) => v.status === 'active')
    .sort((a, b) => b.views - a.views);

  return (
    <div className="min-h-screen w-full bg-white dark:bg-ink">
      <Header />
      <main className="mx-auto w-full max-w-[1100px] px-3 pb-16 pt-3">
        <BannerAd />

        <div className="my-3 flex items-center gap-2 border-b border-black/10 pb-3 dark:border-white/10">
          <FlameIcon size={22} className="text-orange-500" />
          <h1 className="text-[18px] font-bold text-[#0f0f0f] dark:text-white">
            Trending & Popular Videos
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

        <div className="space-y-5">
          {trendingList.map((video) => (
            <React.Fragment key={video.id}>
              <VideoCard video={video} />
              <div className="py-1">
                <BannerAd />
              </div>
            </React.Fragment>
          ))}
        </div>
      </main>
    </div>
  );
}
