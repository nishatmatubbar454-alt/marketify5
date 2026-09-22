import React from 'react';
import { AlertTriangleIcon } from 'lucide-react';
import { isDirectLink } from '../utils/helpers';

interface EmbedPlayerProps {
  src: string;
  title: string;
  poster?: string;
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

  // Handle xnxx.tv redirects to xnxx.com
  if (processed.includes('xnxx.tv/')) {
    processed = processed.replace(/xnxx\.tv/g, 'xnxx.com');
  }
  // Convert standard xnxx page links to embedframe links
  if (processed.includes('xnxx.com/video-') && !processed.includes('/embedframe/')) {
    const match = processed.match(/xnxx\.com\/video-([a-zA-Z0-9]+)/);
    if (match && match[1]) {
      return `https://www.xnxx.com/embedframe/${match[1]}`;
    }
  }

  // Handle xvideos page links to embedframe
  if (processed.includes('xvideos.com/video') && !processed.includes('/embedframe/')) {
    const match = processed.match(/xvideos\.com\/video\.?([a-zA-Z0-9_-]+)/);
    if (match && match[1]) {
      return `https://www.xvideos.com/embedframe/${match[1]}`;
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
      return `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0&playsinline=1`;
    }
  } else if (processed.includes('youtube.com/shorts/')) {
    const videoId = processed.split('shorts/')[1]?.split('?')[0]?.split('/')[0];
    if (videoId) {
      return `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0&playsinline=1`;
    }
  } else if (processed.includes('youtu.be/')) {
    const videoId = processed.split('youtu.be/')[1]?.split('?')[0]?.split('/')[0];
    if (videoId) {
      return `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0&playsinline=1`;
    }
  } else if (processed.includes('vimeo.com/') && !processed.includes('player.vimeo.com/video/')) {
    const vimeoId = processed.split('vimeo.com/')[1]?.split('?')[0]?.split('/')[0];
    if (vimeoId) {
      return `https://player.vimeo.com/video/${vimeoId}?autoplay=1`;
    }
  } else if (processed.includes('dailymotion.com/video/') && !processed.includes('dailymotion.com/embed/video/')) {
    const dailyId = processed.split('dailymotion.com/video/')[1]?.split('?')[0]?.split('/')[0];
    if (dailyId) {
      return `https://www.dailymotion.com/embed/video/${dailyId}?autoplay=1`;
    }
  }

  return processed;
}

export function EmbedPlayer({ src, title, poster }: EmbedPlayerProps) {
  const [iframeLoaded, setIframeLoaded] = React.useState(false);

  React.useEffect(() => {
    setIframeLoaded(false);
    // Fallback timer so loading overlay never gets stuck if iframe cross-origin suppresses event
    const timer = setTimeout(() => {
      setIframeLoaded(true);
    }, 2200);
    return () => clearTimeout(timer);
  }, [src]);

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
      {/* Instant visual poster backdrop while player initializes */}
      {!iframeLoaded && !isDirect && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black transition-opacity duration-300">
          {poster && (
            <img
              src={poster}
              alt=""
              className="absolute inset-0 h-full w-full object-cover opacity-40 blur-[2px]"
            />
          )}
          <div className="relative z-10 flex flex-col items-center gap-2 text-white">
            <div className="h-9 w-9 animate-spin rounded-full border-2 border-white/20 border-t-white" />
            <span className="text-[12px] font-medium tracking-wide text-white/90 drop-shadow">ভিডিও লোড হচ্ছে...</span>
          </div>
        </div>
      )}

      {isDirect ? (
        <video
          src={src}
          poster={poster}
          controls
          playsInline
          autoPlay
          preload="auto"
          className="absolute inset-0 h-full w-full object-contain bg-black"
        />
      ) : (
        <div className="absolute inset-0 w-full h-full bg-black">
          <iframe
            src={embedSrc}
            title={title}
            frameBorder={0}
            loading="eager"
            referrerPolicy="no-referrer"
            sandbox="allow-scripts allow-same-origin allow-presentation allow-forms"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
            allowFullScreen
            onLoad={() => setIframeLoaded(true)}
            className="absolute inset-0 h-full w-full border-0 bg-black"
          />
        </div>
      )}
    </div>
  );
}

