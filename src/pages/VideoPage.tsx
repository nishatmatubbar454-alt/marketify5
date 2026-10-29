import React, { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { BookmarkIcon, HeartIcon, Share2Icon, DownloadIcon } from 'lucide-react';
import { Header } from '../components/Header';
import { BannerAd } from '../components/BannerAd';
import { EmbedPlayer } from '../components/EmbedPlayer';
import { RelatedVideoCard } from '../components/RelatedVideoCard';
import { Pagination } from '../components/Pagination';
import { bumpVideoCounter, useVideos } from '../hooks/useVideos';
import { formatCount, formatViews, timeAgo } from '../utils/format';
import { shareVideo } from '../utils/share';
import { addHistory, getFavorites, getHistory, toggleFavorite } from '../utils/helpers';
import { useDownloadDirectLink, DEFAULT_DOWNLOAD_LINK } from '../utils/downloadLink';
import type { Video } from '../types';

export function VideoPage() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const stateVideo = (location.state as { video?: Video } | null)?.video;
  const { videos, loading } = useVideos();
  const { downloadLink } = useDownloadDirectLink();

  const [directVideo, setDirectVideo] = useState<Video | null>(null);
  const [fetchingDirect, setFetchingDirect] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [liked, setLiked] = useState(false);
  const [favorite, setFavorite] = useState(false);
  const [toast, setToast] = useState('');
  const [optimisticLikes, setOptimisticLikes] = useState<number | null>(null);

  // Periodic clock check: Every 30 seconds to catch when a full 10-minute block arrives.
  // Numbers DO NOT tick every second, so users never see an artificial real-time counter.
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    setNow(Date.now());
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 30000);
    return () => clearInterval(timer);
  }, [id]);

  const [relatedPage, setRelatedPage] = useState(1);
  const RELATED_PAGE_SIZE = 12;

  // Immediate video resolution: checks stateVideo -> videos -> directVideo
  const video = useMemo(() => {
    if (stateVideo && stateVideo.id === id) return stateVideo;
    const found = videos.find((v) => v.id === id);
    if (found) return found;
    if (directVideo && directVideo.id === id) return directVideo;
    return null;
  }, [stateVideo, videos, id, directVideo]);

  // Fast single-video direct fetch (loads in ~100ms instead of waiting 5-10s for the whole database!)
  useEffect(() => {
    if (!id) return;

    // If already resolved via stateVideo or videos cache
    if (stateVideo && stateVideo.id === id) {
      setFetchingDirect(false);
      setNotFound(false);
      return;
    }
    const foundInList = videos.find((v) => v.id === id);
    if (foundInList) {
      setFetchingDirect(false);
      setNotFound(false);
      return;
    }

    let isMounted = true;
    setFetchingDirect(true);
    setNotFound(false);

    // 1. Fetch exact single video directly from Firebase RTDB (returns in ~100ms, only ~1KB)
    fetch(`https://himrw-fae65-default-rtdb.firebaseio.com/videos/${id}.json`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!isMounted) return;
        if (data && typeof data === 'object') {
          const embedUrl = (data.embedUrl as string) || '';
          const websiteUrl = (data.websiteUrl as string) || (data.targetUrl as string) || '';
          if (embedUrl.trim() || websiteUrl.trim()) {
            const mapped: Video = {
              id,
              thumbnailUrl: (data.thumbnailUrl as string) || '',
              embedUrl: embedUrl.trim(),
              websiteUrl: websiteUrl.trim(),
              title: (data.title as string) || 'Untitled video',
              sourceName: (data.sourceName as string) || 'Marketify',
              duration: (data.duration as string) || '',
              status: (data.status as Video['status']) || 'active',
              views: typeof data.views === 'number' ? (data.views as number) : 0,
              likes: typeof data.likes === 'number' ? (data.likes as number) : 0,
              commentsCount: typeof data.commentsCount === 'number' ? (data.commentsCount as number) : 0,
              createdAt: (data.createdAt as number) || (data.updatedAt as number) || 0,
              updatedAt: (data.updatedAt as number) || (data.createdAt as number) || 0
            };
            setDirectVideo(mapped);
            setFetchingDirect(false);
            setNotFound(false);
            return;
          }
        }

        // 2. Fallback to Express backend if hosted on full-stack server
        fetch(`/api/videos/${id}`)
          .then((r) => (r.ok ? r.json() : null))
          .then((servData) => {
            if (!isMounted) return;
            if (servData && servData.video) {
              setDirectVideo(servData.video);
              setFetchingDirect(false);
              setNotFound(false);
            } else {
              setFetchingDirect(false);
              setNotFound(true);
            }
          })
          .catch(() => {
            if (isMounted) {
              setFetchingDirect(false);
              setNotFound(true);
            }
          });
      })
      .catch(() => {
        if (isMounted) {
          setFetchingDirect(false);
          setNotFound(true);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [id, stateVideo, videos]);

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

  const totalRelatedPages = Math.ceil(related.length / RELATED_PAGE_SIZE);

  const visibleRelated = useMemo(() => {
    const start = (relatedPage - 1) * RELATED_PAGE_SIZE;
    return related.slice(start, start + RELATED_PAGE_SIZE);
  }, [related, relatedPage]);

  useLayoutEffect(() => {
    window.scrollTo(0, 0);
    setRelatedPage(1);
  }, [id]);

  useEffect(() => {
    if (!id || !video) return;
    setLiked(localStorage.getItem(`mk-like-${id}`) === '1');
    setFavorite(getFavorites().includes(id));
    setOptimisticLikes(null);
    addHistory(id);

    if (!video.embedUrl && video.websiteUrl) {
      const url = video.websiteUrl.startsWith('http://') || video.websiteUrl.startsWith('https://')
        ? video.websiteUrl
        : `https://${video.websiteUrl}`;
      window.location.replace(url);
    }
  }, [id, video]);

  useEffect(() => {
    if (!id || !video) return;
    const key = `mk-viewed-${id}`;
    if (!sessionStorage.getItem(key)) {
      sessionStorage.setItem(key, '1');
      bumpVideoCounter(id, 'views');
    }
  }, [id, video]);

  // Auto-increment: exactly +138 likes and +250 views every 10 full minutes (600,000 ms)
  // Increases in discreet lumps of 138 likes and 250 views — zero per-second ticking!
  const TEN_MIN_MS = 10 * 60 * 1000;
  const baseCreatedAt = typeof video?.createdAt === 'number' && video.createdAt > 0
    ? video.createdAt
    : (typeof video?.updatedAt === 'number' && video.updatedAt > 0 ? video.updatedAt : now);

  const elapsedMs = Math.max(0, now - baseCreatedAt);
  const tenMinuteBlocks = Math.floor(elapsedMs / TEN_MIN_MS);

  const autoLikes = tenMinuteBlocks * 138;
  const autoViews = tenMinuteBlocks * 250;

  const baseLikes = video?.likes || 0;
  const userLikesDelta = optimisticLikes !== null ? optimisticLikes - baseLikes : 0;
  const currentLikes = Math.max(0, baseLikes + autoLikes + userLikesDelta);
  const currentViews = Math.max(0, (video?.views || 0) + autoViews);

  const onLike = () => {
    if (!id || !video) return;
    const newLiked = !liked;
    setLiked(newLiked);
    localStorage.setItem(`mk-like-${id}`, newLiked ? '1' : '0');
    setOptimisticLikes(baseLikes + (newLiked ? 1 : 0));
    bumpVideoCounter(id, 'likes', newLiked ? 1 : -1);
  };

  const onShare = async () => {
    if (!video) return;
    const res = await shareVideo(video.id, video.title);
    if (res && res.includes('copied')) {
      setToast('Link copied to clipboard!');
      window.setTimeout(() => setToast(''), 2000);
    }
  };

  const onDownload = () => {
    const targetUrl = downloadLink || DEFAULT_DOWNLOAD_LINK;
    window.open(targetUrl, '_blank', 'noopener,noreferrer');
  };

  const handleRelatedPageChange = (newPage: number) => {
    setRelatedPage(newPage);
    const el = document.getElementById('related-grid');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const isResolving = !video && (fetchingDirect || (loading && !notFound));

  return (
    <div className="min-h-screen w-full bg-white dark:bg-ink">
      <Header />
      <main className="mx-auto w-full max-w-[1100px] px-2 pb-28 sm:pb-32 pt-2">
        <BannerAd />

        <section className="mt-2 overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-black/5 dark:bg-panel dark:ring-white/5">
          {isResolving ? (
            /* Smooth Fast Loading Spinner - Never show 'This video is not available' while resolving */
            <div className="w-full flex flex-col items-center justify-center bg-black/10 dark:bg-[#121212]" style={{ aspectRatio: '16 / 9' }}>
              <div className="h-10 w-10 animate-spin rounded-full border-3 border-brand border-t-transparent" />
              <p className="mt-3 text-xs text-[#808080] animate-pulse">ভিডিও লোড হচ্ছে...</p>
            </div>
          ) : video?.embedUrl ? (
            <EmbedPlayer src={video.embedUrl} title={video.title} poster={video.thumbnailUrl} />
          ) : video?.websiteUrl ? (
            <div className="grid aspect-video place-items-center px-6 text-center">
              <div>
                <p className="text-sm text-[#606060] dark:text-white/60">
                  ওয়েবসাইটে নিয়ে যাওয়া হচ্ছে...
                </p>
                <a
                  href={video.websiteUrl.startsWith('http://') || video.websiteUrl.startsWith('https://') ? video.websiteUrl : `https://${video.websiteUrl}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-block rounded-md bg-brand px-4 py-2 text-sm font-semibold text-[#0f0f0f]"
                >
                  সরাসরি সাইট ওপেন করুন
                </a>
              </div>
            </div>
          ) : (
            /* Only show if truly not found after both direct fetch and list resolution finish */
            <div className="grid aspect-video place-items-center px-6 text-center">
              <div>
                <p className="text-sm text-[#606060] dark:text-white/60">
                  This video is not available.
                </p>
                <Link to="/" className="mt-2 inline-block text-sm font-medium text-brand">
                  Back to home
                </Link>
              </div>
            </div>
          )}

          {isResolving && (
            <div className="p-3 space-y-2 animate-pulse">
              <div className="h-5 w-3/4 rounded bg-black/10 dark:bg-white/10" />
              <div className="h-4 w-1/3 rounded bg-black/10 dark:bg-white/10" />
            </div>
          )}

          {video && (
            <>
              <div className="px-3 pt-2 pb-0.5">
                <h1 className="text-[14px] sm:text-[15px] font-semibold leading-[20px] text-[#0f0f0f] dark:text-white">
                  {video.title}
                </h1>
                <p className="mt-0.5 text-[12px] text-[#606060] dark:text-white/60">
                  {video.sourceName ? `${video.sourceName} • ` : ''}
                  {timeAgo(video.createdAt)}
                </p>
              </div>
              <div className="flex items-center justify-between px-3 py-1.5">
                <span className="flex items-center gap-1.5 text-[12.5px] text-[#606060] dark:text-white/70">
                  <span className="grid h-[17px] w-[17px] place-items-center rounded-full bg-[#ff3040]">
                    <HeartIcon size={10} fill="#fff" color="#fff" />
                  </span>
                  <span className="font-semibold text-[#0f0f0f] dark:text-white">
                    {formatCount(currentLikes)}
                  </span>
                  <span>likes</span>
                </span>
                <span className="text-[12.5px] text-[#606060] dark:text-white/70">
                  <span className="font-semibold text-[#0f0f0f] dark:text-white">
                    {formatViews(currentViews)}
                  </span>
                </span>
              </div>
              <div className="grid grid-cols-4 border-t border-black/10 dark:border-white/10 divide-x divide-black/5 dark:divide-white/5">
                <button
                  type="button"
                  onClick={onLike}
                  aria-pressed={liked}
                  className="flex items-center justify-center gap-1.5 py-2 text-[12px] sm:text-[12.5px] text-[#0f0f0f] transition-all duration-100 ease-out hover:bg-black/5 dark:text-white/90 dark:hover:bg-white/5 active:scale-95 select-none"
                >
                  <HeartIcon
                    size={15}
                    fill={liked ? '#ff3040' : 'none'}
                    color={liked ? '#ff3040' : 'currentColor'}
                  />
                  <span>Like</span>
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
                  className="flex items-center justify-center gap-1.5 py-2 text-[12px] sm:text-[12.5px] text-[#0f0f0f] transition-all duration-100 ease-out hover:bg-black/5 dark:text-white/90 dark:hover:bg-white/5 active:scale-95 select-none"
                >
                  <BookmarkIcon
                    size={15}
                    fill={favorite ? '#ff7a18' : 'none'}
                    color={favorite ? '#ff7a18' : 'currentColor'}
                  />
                  <span>Favorite</span>
                </button>
                <button
                  type="button"
                  onClick={onShare}
                  className="flex items-center justify-center gap-1.5 py-2 text-[12px] sm:text-[12.5px] text-[#0f0f0f] transition-all duration-100 ease-out hover:bg-black/5 dark:text-white/90 dark:hover:bg-white/5 active:scale-95 select-none"
                >
                  <Share2Icon size={15} />
                  <span>Share</span>
                </button>
                <button
                  type="button"
                  onClick={onDownload}
                  className="flex items-center justify-center gap-1.5 py-2 text-[12px] sm:text-[12.5px] font-semibold text-emerald-600 dark:text-emerald-400 hover:text-emerald-500 transition-all duration-100 ease-out hover:bg-emerald-50 dark:hover:bg-emerald-950/20 active:scale-95 select-none"
                  title="ভিডিও ডাউনলোড করুন"
                >
                  <DownloadIcon size={15} className="stroke-[2.2]" />
                  <span>Download</span>
                </button>
              </div>
            </>
          )}
        </section>

        {/* Toast */}
        {toast && (
          <div className="fixed bottom-20 left-1/2 -translate-x-1/2 rounded-full bg-[#0f0f0f] px-4 py-2 text-xs font-semibold text-white shadow-lg dark:bg-white dark:text-[#0f0f0f] z-50">
            {toast}
          </div>
        )}

        {/* Banner Ad directly below main video player card (as it was originally) */}
        <div className="mt-2 mb-2">
          <BannerAd />
        </div>

        {/* 2-column Side-by-Side Related Videos Grid */}
        <div id="related-grid" className="grid grid-cols-2 gap-2">
          {visibleRelated.map((v, index) => (
            <React.Fragment key={v.id}>
              <RelatedVideoCard video={v} />
              {(index + 1) % 2 === 0 && (
                <div className="col-span-2 my-1">
                  <BannerAd />
                </div>
              )}
            </React.Fragment>
          ))}
        </div>

        {related.length > RELATED_PAGE_SIZE && (
          <Pagination
            currentPage={relatedPage}
            totalPages={totalRelatedPages}
            onPageChange={handleRelatedPageChange}
            totalItems={related.length}
            pageSize={RELATED_PAGE_SIZE}
          />
        )}
      </main>
    </div>
  );
}
