import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { BookmarkIcon, MoreVerticalIcon, Share2Icon } from 'lucide-react';
import type { Video } from '../types';
import { formatViews, timeAgo } from '../utils/format';
import { shareVideo } from '../utils/share';
import { addHistory, getFavorites, toggleFavorite } from '../utils/helpers';
import { bumpVideoCounter } from '../hooks/useVideos';

export const VideoCard = React.memo(function VideoCard({ video, priority = false }: { video: Video; priority?: boolean }) {
  const [favorite, setFavorite] = useState(() => getFavorites().includes(video.id));
  const [menuOpen, setMenuOpen] = useState(false);
  const [toast, setToast] = useState('');

  const notify = (message: string) => {
    if (!message) return;
    setToast(message);
    window.setTimeout(() => setToast(''), 1600);
  };

  const onShare = async () => {
    setMenuOpen(false);
    notify(await shareVideo(video.id, video.title));
  };

  const hasEmbed = Boolean(video.embedUrl && video.embedUrl.trim());
  const hasWebsite = Boolean(video.websiteUrl && video.websiteUrl.trim());
  const isExternal = !hasEmbed && hasWebsite;
  const externalHref = isExternal
    ? (video.websiteUrl!.startsWith('http://') || video.websiteUrl!.startsWith('https://')
        ? video.websiteUrl!
        : `https://${video.websiteUrl!}`)
    : '';

  const handleExternalClick = () => {
    addHistory(video.id);
    if (isExternal) {
      void bumpVideoCounter(video.id, 'views', 1);
    }
  };

  const handleInternalClick = () => {
    addHistory(video.id);
  };

  const thumbnailContent = (
    <div className="relative w-full" style={{ aspectRatio: '16 / 9' }}>
      {video.thumbnailUrl ? (
        <img
          src={video.thumbnailUrl}
          alt=""
          loading={priority ? 'eager' : 'lazy'}
          fetchPriority={priority ? 'high' : 'auto'}
          decoding="async"
          className="pointer-events-none absolute inset-0 h-full w-full object-cover transition-opacity duration-150"
        />
      ) : (
        <div className="pointer-events-none absolute inset-0 bg-neutral-800" />
      )}
      <span className="pointer-events-none absolute inset-0 grid place-items-center">
        <svg viewBox="0 0 24 24" className="h-14 w-14 drop-shadow-lg" aria-hidden="true">
          <path d="M8 5.5v13l11-6.5-11-6.5z" fill="rgba(255,255,255,0.92)" />
        </svg>
      </span>
      <span className="pointer-events-none absolute bottom-2 left-3 text-[13px] font-medium text-white drop-shadow">
        {formatViews(video.views)}
      </span>
      {video.duration && (
        <span className="pointer-events-none absolute bottom-2 right-3 rounded bg-black/80 px-1.5 py-0.5 text-[11px] font-medium text-white">
          {video.duration}
        </span>
      )}
    </div>
  );

  return (
    <article className="relative">
      {isExternal ? (
        <a
          href={externalHref}
          target="_blank"
          rel="noopener noreferrer"
          onClick={handleExternalClick}
          className="group block overflow-hidden rounded-xl bg-black cursor-pointer select-none transition-transform duration-75 active:scale-[0.98]"
          aria-label={video.title}
        >
          {thumbnailContent}
        </a>
      ) : (
        <Link
          to={`/video/${video.id}`}
          state={{ video }}
          onClick={handleInternalClick}
          className="group block overflow-hidden rounded-xl bg-black cursor-pointer select-none transition-transform duration-75 active:scale-[0.98]"
          aria-label={video.title}
        >
          {thumbnailContent}
        </Link>
      )}

      <button
        type="button"
        onClick={() => {
          const added = toggleFavorite(video.id);
          setFavorite(added);
          notify(added ? 'Added to favorites' : 'Removed from favorites');
        }}
        aria-label={favorite ? 'Remove from favorites' : 'Add to favorites'}
        className={`absolute left-2 top-2 grid h-9 w-9 place-items-center rounded-full text-white shadow-md transition-all duration-100 ease-out active:scale-90 ${
          favorite ? 'bg-red-600' : 'bg-black/60 hover:bg-black/80'
        }`}
      >
        <BookmarkIcon size={18} fill={favorite ? '#fff' : 'none'} />
      </button>

      <div className="mt-3 flex items-start gap-3 px-1">
        {isExternal ? (
          <a
            href={externalHref}
            target="_blank"
            rel="noopener noreferrer"
            onClick={handleExternalClick}
            aria-hidden="true"
            tabIndex={-1}
            className="mt-0.5 grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-full bg-neutral-900 text-sm font-bold uppercase text-white ring-1 ring-black/10 dark:ring-white/10 active:scale-95 transition-transform"
          >
            {(video.sourceName || 'M').charAt(0)}
          </a>
        ) : (
          <Link
            to={`/video/${video.id}`}
            state={{ video }}
            onClick={handleInternalClick}
            aria-hidden="true"
            tabIndex={-1}
            className="mt-0.5 grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-full bg-neutral-900 text-sm font-bold uppercase text-white ring-1 ring-black/10 dark:ring-white/10 active:scale-95 transition-transform"
          >
            {(video.sourceName || 'M').charAt(0)}
          </Link>
        )}
        <div className="min-w-0 flex-1">
          {isExternal ? (
            <a
              href={externalHref}
              target="_blank"
              rel="noopener noreferrer"
              onClick={handleExternalClick}
              className="clamp-2 text-[16px] font-normal leading-[22px] text-[#0f0f0f] dark:text-white hover:text-brand transition-colors active:opacity-75"
            >
              {video.title}
            </a>
          ) : (
            <Link
              to={`/video/${video.id}`}
              state={{ video }}
              onClick={handleInternalClick}
              className="clamp-2 text-[16px] font-normal leading-[22px] text-[#0f0f0f] dark:text-white hover:text-brand transition-colors active:opacity-75"
            >
              {video.title}
            </Link>
          )}
          <div className="mt-1.5 flex items-center justify-between gap-2">
            <p className="truncate text-[14px] text-[#606060] dark:text-white/60">
              {video.sourceName ? `${video.sourceName} • ` : ''}
              {timeAgo(video.createdAt)}
            </p>
            <button
              type="button"
              onClick={onShare}
              aria-label="Share video"
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-[#606060] transition-all duration-100 ease-out hover:bg-black/5 dark:text-white/70 dark:hover:bg-white/10 active:scale-90"
            >
              <Share2Icon size={20} />
            </button>
          </div>
        </div>
        <div className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="More options"
            aria-expanded={menuOpen}
            className="grid h-9 w-9 place-items-center rounded-full text-[#606060] transition-all duration-100 ease-out hover:bg-black/5 dark:text-white/70 dark:hover:bg-white/10 active:scale-90"
          >
            <MoreVerticalIcon size={20} />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-10 z-20 w-40 overflow-hidden rounded-lg bg-white shadow-lg ring-1 ring-black/10 dark:bg-panel2 dark:ring-white/10 animate-in fade-in duration-100">
              <button
                type="button"
                onClick={onShare}
                className="block w-full px-4 py-2.5 text-left text-sm text-[#0f0f0f] hover:bg-black/5 dark:text-white dark:hover:bg-white/10 active:bg-black/10 dark:active:bg-white/15"
              >
                Share
              </button>
              {isExternal ? (
                <a
                  href={externalHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={handleExternalClick}
                  className="block w-full border-t border-black/5 px-4 py-2.5 text-left text-sm text-[#0f0f0f] hover:bg-black/5 dark:border-white/10 dark:text-white dark:hover:bg-white/10 active:bg-black/10 dark:active:bg-white/15"
                >
                  Visit link
                </a>
              ) : (
                <Link
                  to={`/video/${video.id}`}
                  state={{ video }}
                  onClick={handleInternalClick}
                  className="block w-full border-t border-black/5 px-4 py-2.5 text-left text-sm text-[#0f0f0f] hover:bg-black/5 dark:border-white/10 dark:text-white dark:hover:bg-white/10 active:bg-black/10 dark:active:bg-white/15"
                >
                  Open video
                </Link>
              )}
            </div>
          )}
        </div>
      </div>
      {toast && (
        <p role="status" className="mt-2 px-1 text-[13px] font-medium text-brand">
          {toast}
        </p>
      )}
    </article>
  );
});
