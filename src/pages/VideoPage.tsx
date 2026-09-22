import React, { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { BookmarkIcon, HeartIcon, Share2Icon } from 'lucide-react';
import { Header } from '../components/Header';
import { BannerAd } from '../components/BannerAd';
import { EmbedPlayer } from '../components/EmbedPlayer';
import { RelatedVideoCard } from '../components/RelatedVideoCard';
import { bumpVideoCounter, useVideos } from '../hooks/useVideos';
import { formatViews, timeAgo } from '../utils/format';
import { shareVideo } from '../utils/share';
import { addHistory, getFavorites, getHistory, toggleFavorite } from '../utils/helpers';
import type { Video } from '../types';

export function VideoPage() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const stateVideo = (location.state as { video?: Video } | null)?.video;
  const { videos, loading, error } = useVideos();

  const [liked, setLiked] = useState(false);
  const [favorite, setFavorite] = useState(false);
  const [toast, setToast] = useState('');
  const [optimisticLikes, setOptimisticLikes] = useState<number | null>(null);

  const [relatedLimit, setRelatedLimit] = useState(12);

  // Immediate video resolution: If passed via state or localStorage, available in 0ms!
  const video = useMemo(() => {
    if (stateVideo && stateVideo.id === id) return stateVideo;
    const found = videos.find((v) => v.id === id);
    if (found) return found;
    try {
      const raw = localStorage.getItem('mk-local-videos');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          return parsed.find((v: Video) => v.id === id) || null;
        }
      }
    } catch {}
    return null;
  }, [stateVideo, videos, id]);

  const related = useMemo(() => {
    const active = videos.filter((v) => v.status === 'active' && v.id !== id);
    const history = getHistory();
    const historySet = new Set(history);

    const unseen = active.filter((v) => !historySet.has(v.id));
    const seen = active.filter((v) => historySet.has(v.id));

    return [
      ...unseen.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)),
      ...seen.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
    ];
  }, [videos, id]);

  const visibleRelated = useMemo(() => {
    return related.slice(0, relatedLimit);
  }, [related, relatedLimit]);

  useLayoutEffect(() => {
    window.scrollTo(0, 0);
  }, [id]);

  useEffect(() => {
    if (!id || !video || !video.embedUrl) return;
    setLiked(localStorage.getItem(`mk-like-${id}`) === '1');
    setFavorite(getFavorites().includes(id));
    setOptimisticLikes(null);
    addHistory(id);
  }, [id, video]);

  useEffect(() => {
    if (!id || !video || !video.embedUrl) return;
    const key = `mk-viewed-${id}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, '1');
    void bumpVideoCounter(id, 'views', 1);
  }, [id, video]);

  const baseLikes = video ? video.likes : 0;
  const currentLikes = optimisticLikes !== null ? optimisticLikes : baseLikes;

  const onLike = async () => {
    if (!id || !video) return;
    const next = !liked;
    setLiked(next);
    localStorage.setItem(`mk-like-${id}`, next ? '1' : '0');
    const updatedCount = Math.max(0, currentLikes + (next ? 1 : -1));
    setOptimisticLikes(updatedCount);
    try {
      await bumpVideoCounter(id, 'likes', next ? 1 : -1);
    } catch {
      setToast('Could not save your like');
      window.setTimeout(() => setToast(''), 1600);
    }
  };

  const onShare = async () => {
    if (!video) return;
    const message = await shareVideo(video.id, video.title);
    if (message) {
      setToast(message);
      window.setTimeout(() => setToast(''), 1600);
    }
  };

  return (
    <div className="min-h-screen w-full bg-white dark:bg-ink">
      <Header />
      <main className="mx-auto w-full max-w-[1100px] px-2 pb-16 pt-2">
        <BannerAd />

        <section className="mt-2 overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-black/5 dark:bg-panel dark:ring-white/5">
          {loading && !video ? (
            <div className="w-full animate-pulse bg-black/10 dark:bg-white/10" style={{ aspectRatio: '16 / 9' }} />
          ) : video ? (
            <EmbedPlayer src={video.embedUrl} title={video.title} poster={video.thumbnailUrl} />
          ) : (
            <div className="grid aspect-video place-items-center px-6 text-center">
              <div>
                <p className="text-sm text-[#606060] dark:text-white/60">
                  {error ? `Could not load this video: ${error}` : 'This video is not available.'}
                </p>
                <Link to="/" className="mt-2 inline-block text-sm font-medium text-brand">
                  Back to home
                </Link>
              </div>
            </div>
          )}

          {video && (
            <>
              <div className="px-3 pt-3">
                <h1 className="text-[15px] font-medium leading-[21px] text-[#0f0f0f] dark:text-white">
                  {video.title}
                </h1>
                <p className="mt-1 text-[13px] text-[#606060] dark:text-white/60">
                  {video.sourceName ? `${video.sourceName} • ` : ''}
                  {timeAgo(video.createdAt)}
                </p>
              </div>
              <div className="flex items-center justify-between px-3 py-3">
                <span className="flex items-center gap-1.5 text-[13px] text-[#606060] dark:text-white/70">
                  <span className="grid h-[18px] w-[18px] place-items-center rounded-full bg-[#ff3040]">
                    <HeartIcon size={11} fill="#fff" color="#fff" />
                  </span>
                  {currentLikes.toLocaleString()} likes
                </span>
                <span className="text-[13px] text-[#606060] dark:text-white/70">
                  {formatViews(video.views)}
                </span>
              </div>
              <div className="grid grid-cols-3 border-t border-black/10 dark:border-white/10">
                <button
                  type="button"
                  onClick={onLike}
                  aria-pressed={liked}
                  className="flex items-center justify-center gap-1.5 py-3 text-[13px] text-[#0f0f0f] transition-all duration-100 ease-out hover:bg-black/5 dark:text-white/90 dark:hover:bg-white/5 active:scale-95 select-none"
                >
                  <HeartIcon
                    size={17}
                    fill={liked ? '#ff3040' : 'none'}
                    color={liked ? '#ff3040' : 'currentColor'}
                  />
                  Like
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const added = toggleFavorite(video.id);
                    setFavorite(added);
                    setToast(added ? 'Added to favorites' : 'Removed from favorites');
                    window.setTimeout(() => setToast(''), 1500);
                  }}
                  aria-pressed={favorite}
                  className="flex items-center justify-center gap-1.5 py-3 text-[13px] text-[#0f0f0f] transition-all duration-100 ease-out hover:bg-black/5 dark:text-white/90 dark:hover:bg-white/5 active:scale-95 select-none"
                >
                  <BookmarkIcon size={17} fill={favorite ? '#ff3040' : 'none'} color={favorite ? '#ff3040' : 'currentColor'} />
                  Favorite
                </button>
                <button
                  type="button"
                  onClick={onShare}
                  className="flex items-center justify-center gap-1.5 py-3 text-[13px] text-[#0f0f0f] transition-all duration-100 ease-out hover:bg-black/5 dark:text-white/90 dark:hover:bg-white/5 active:scale-95 select-none"
                >
                  <Share2Icon size={17} />
                  Share
                </button>
              </div>
            </>
          )}
        </section>

        {toast && (
          <p role="status" className="py-2 text-center text-[13px] font-medium text-brand">
            {toast}
          </p>
        )}

        <div className="mt-2">
          <BannerAd />
        </div>

        <div className="mt-2 grid grid-cols-2 gap-2">
          {visibleRelated.map((v, index) => (
            <React.Fragment key={v.id}>
              <RelatedVideoCard video={v} />
              {(index + 1) % 2 === 0 && (
                <div className="col-span-2">
                  <BannerAd />
                </div>
              )}
            </React.Fragment>
          ))}
        </div>

        {related.length > visibleRelated.length && (
          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={() => setRelatedLimit((prev) => prev + 12)}
              className="rounded-lg bg-black/5 px-4 py-2 text-xs font-semibold text-brand hover:bg-black/10 dark:bg-white/5 dark:hover:bg-white/10"
            >
              আরও সম্পর্কিত ভিডিও দেখুন ({related.length - visibleRelated.length}টি বাকি)
            </button>
          </div>
        )}
      </main>
    </div>
  );
}

