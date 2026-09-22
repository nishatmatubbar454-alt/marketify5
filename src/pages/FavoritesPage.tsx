import React from 'react';
import { Header } from '../components/Header';
import { BannerAd } from '../components/BannerAd';
import { VideoCard } from '../components/VideoCard';
import { useVideos } from '../hooks/useVideos';
import { getFavorites } from '../utils/helpers';
import { BookmarkIcon } from 'lucide-react';
import { Link } from 'react-router-dom';

export function FavoritesPage() {
  const { videos, loading } = useVideos();
  const favIds = getFavorites();
  const favVideos = favIds
    .map((id) => videos.find((v) => v.id === id))
    .filter((v): v is NonNullable<typeof v> => v !== undefined && v.status === 'active');

  return (
    <div className="min-h-screen w-full bg-white dark:bg-ink">
      <Header />
      <main className="mx-auto w-full max-w-[1100px] px-3 pb-16 pt-3">
        <BannerAd />

        <div className="my-3 flex items-center gap-2 border-b border-black/10 pb-3 dark:border-white/10">
          <BookmarkIcon size={22} className="text-red-500" />
          <h1 className="text-[18px] font-bold text-[#0f0f0f] dark:text-white">
            Favorite Videos
          </h1>
        </div>

        {loading && (
          <div className="space-y-6">
            <div className="animate-pulse w-full rounded-xl bg-black/10 dark:bg-white/10" style={{ aspectRatio: '16 / 9' }} />
          </div>
        )}

        {!loading && favVideos.length === 0 && (
          <div className="py-16 text-center">
            <p className="text-[15px] text-[#606060] dark:text-white/60">
              No favorite videos added yet. Click the favorite icon on any video to save it here.
            </p>
            <Link to="/" className="mt-2 inline-block text-sm font-medium text-brand">
              Explore videos
            </Link>
          </div>
        )}

        <div className="space-y-3">
          {favVideos.map((video, index) => (
            <div key={video.id} className="space-y-1.5">
              <VideoCard video={video} priority={index < 2} />
              <BannerAd />
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
