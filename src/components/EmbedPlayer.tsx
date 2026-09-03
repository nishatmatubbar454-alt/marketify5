import React from 'react';
import { AlertTriangleIcon } from 'lucide-react';
import { isDirectLink } from '../utils/helpers';

interface EmbedPlayerProps {
  src: string;
  title: string;
}

export function extractEmbedUrl(url: string): string {
  if (!url) return '';
  let processed = url.trim();

  // If user pasted full iframe tag: <iframe src="..." ...>
  if (processed.includes('<iframe') || processed.includes('src=')) {
    const srcMatch = processed.match(/src=["']([^"']+)["']/i);
    if (srcMatch && srcMatch[1]) {
      processed = srcMatch[1].trim();
    }
  }

  // Convert Google Drive view/open URLs to preview URLs
  if (processed.includes('drive.google.com/file/d/')) {
    const fileIdMatch = processed.match(/\/file\/d\/([^\/\?#]+)/);
    if (fileIdMatch && fileIdMatch[1]) {
      return `https://drive.google.com/file/d/${fileIdMatch[1]}/preview`;
    }
  } else if (processed.includes('drive.google.com/open?id=') || processed.includes('drive.google.com/uc?id=')) {
    const idMatch = processed.match(/id=([^&]+)/);
    if (idMatch && idMatch[1]) {
      return `https://drive.google.com/file/d/${idMatch[1]}/preview`;
    }
  }

  // Convert YouTube watch/shorts/share URLs to embed URLs
  if (processed.includes('youtube.com/watch?v=') || processed.includes('m.youtube.com/watch?v=')) {
    const videoId = processed.split('watch?v=')[1]?.split('&')[0];
    if (videoId) {
      return `https://www.youtube.com/embed/${videoId}`;
    }
  } else if (processed.includes('youtube.com/shorts/')) {
    const videoId = processed.split('shorts/')[1]?.split('?')[0]?.split('/')[0];
    if (videoId) {
      return `https://www.youtube.com/embed/${videoId}`;
    }
  } else if (processed.includes('youtu.be/')) {
    const videoId = processed.split('youtu.be/')[1]?.split('?')[0]?.split('/')[0];
    if (videoId) {
      return `https://www.youtube.com/embed/${videoId}`;
    }
  } else if (processed.includes('vimeo.com/') && !processed.includes('player.vimeo.com/video/')) {
    const vimeoId = processed.split('vimeo.com/')[1]?.split('?')[0]?.split('/')[0];
    if (vimeoId) {
      return `https://player.vimeo.com/video/${vimeoId}`;
    }
  } else if (processed.includes('dailymotion.com/video/') && !processed.includes('dailymotion.com/embed/video/')) {
    const dailyId = processed.split('dailymotion.com/video/')[1]?.split('?')[0]?.split('/')[0];
    if (dailyId) {
      return `https://www.dailymotion.com/embed/video/${dailyId}`;
    }
  }

  return processed;
}

export function EmbedPlayer({ src, title }: EmbedPlayerProps) {
  if (!src) {
    return (
      <div className="flex aspect-video w-full items-center justify-center gap-2 bg-black px-6 text-center text-sm text-white/60">
        <AlertTriangleIcon size={16} />
        This video has no embed URL yet.
      </div>
    );
  }

  const isDirect = isDirectLink(src) || src.match(/\.(mp4|webm|ogg|mov|m3u8)([\?#]|$)/i);
  const embedSrc = extractEmbedUrl(src);

  return (
    <div className="relative w-full bg-black overflow-hidden" style={{ aspectRatio: '16 / 9' }}>
      {isDirect ? (
        <video
          src={src}
          controls
          playsInline
          autoPlay
          preload="metadata"
          className="absolute inset-0 h-full w-full object-contain bg-black"
        />
      ) : (
        <div className="absolute inset-0 w-full h-full bg-black">
          <iframe
            src={embedSrc}
            title={title}
            frameBorder={0}
            loading="lazy"
            sandbox="allow-scripts allow-same-origin allow-presentation allow-forms"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
            allowFullScreen
            className="absolute inset-0 h-full w-full border-0 bg-black"
          />
        </div>
      )}
    </div>
  );
}

