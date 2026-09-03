import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { HeartIcon, MessageSquareIcon } from 'lucide-react';
import type { Video } from '../types';

export function RelatedVideoCard({ video }: { video: Video }) {
  const [liked, setLiked] = useState(false);

  return (
    <article className="overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-black/5 dark:bg-panel dark:ring-white/5">
      <Link to={`/video/${video.id}`} className="block" aria-label={video.title}>
        <div className="relative w-full" style={{ aspectRatio: '16 / 9' }}>
          {video.thumbnailUrl ? (
            <img
              src={video.thumbnailUrl}
              alt=""
              loading="lazy"
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 bg-neutral-800" />
          )}
          <span className="absolute inset-0 grid place-items-center">
            <svg viewBox="0 0 24 24" className="h-10 w-10 drop-shadow-md" aria-hidden="true">
              <path d="M8 5.5v13l11-6.5-11-6.5z" fill="rgba(255,255,255,0.92)" />
            </svg>
          </span>
          {video.duration && (
            <span className="absolute bottom-1.5 right-1.5 rounded bg-black/80 px-1.5 py-0.5 text-[11px] font-medium text-white">
              {video.duration}
            </span>
          )}
        </div>
      </Link>
      <div className="px-2.5 pb-2 pt-2">
        <Link
          to={`/video/${video.id}`}
          className="clamp-2 text-[13px] font-medium leading-[18px] text-[#0f0f0f] dark:text-white"
        >
          {video.title}
        </Link>
        <div className="mt-2 flex items-center justify-end gap-4 text-[#606060] dark:text-white/60">
          <button
            type="button"
            onClick={() => setLiked((v) => !v)}
            aria-label={liked ? 'Unlike' : 'Like'}
            aria-pressed={liked}
            className="transition-all duration-100 ease-out hover:text-brand active:scale-90"
          >
            <HeartIcon size={16} fill={liked ? '#ff3040' : 'none'} color={liked ? '#ff3040' : 'currentColor'} />
          </button>
          <Link to={`/video/${video.id}`} aria-label="Comments" className="transition-all duration-100 ease-out hover:text-brand active:scale-90">
            <MessageSquareIcon size={16} />
          </Link>
        </div>
      </div>
    </article>
  );
}
