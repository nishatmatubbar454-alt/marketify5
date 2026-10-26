/**
 * Accepts either a bare embed URL or a full <iframe ...> snippet and safely
 * returns ONLY the iframe src. Never executes or renders arbitrary HTML.
 */
export function extractEmbedSrc(input: string): string {
  const raw = (input || '').trim();
  if (!raw) return '';

  let candidate = raw;
  const iframeMatch = raw.match(/<iframe[^>]*\ssrc\s*=\s*["']([^"']+)["'][^>]*>/i);
  if (iframeMatch) {
    candidate = iframeMatch[1].trim();
  }

  if (candidate.includes('youtube.com/watch?v=')) {
    const match = candidate.match(/[?&]v=([^&]+)/);
    if (match) candidate = `https://www.youtube.com/embed/${match[1]}`;
  } else if (candidate.includes('youtu.be/')) {
    const match = candidate.match(/youtu\.be\/([^?&/]+)/);
    if (match) candidate = `https://www.youtube.com/embed/${match[1]}`;
  } else if (candidate.includes('youtube.com/shorts/')) {
    const match = candidate.match(/shorts\/([^?&/]+)/);
    if (match) candidate = `https://www.youtube.com/embed/${match[1]}`;
  } else if (candidate.includes('xnxx.tv/')) {
    candidate = candidate.replace(/xnxx\.tv/g, 'xnxx.com');
  } else if (candidate.includes('xnxx.com/video-') && !candidate.includes('/embedframe/')) {
    const match = candidate.match(/xnxx\.com\/video-([a-zA-Z0-9]+)/);
    if (match && match[1]) {
      candidate = `https://www.xnxx.com/embedframe/${match[1]}`;
    }
  } else if (candidate.includes('xvideos.com/video') && !candidate.includes('/embedframe/')) {
    const match = candidate.match(/xvideos\.com\/video\.?([a-zA-Z0-9_-]+)/);
    if (match && match[1]) {
      candidate = `https://www.xvideos.com/embedframe/${match[1]}`;
    }
  }

  if (candidate.startsWith('//')) candidate = 'https:' + candidate;

  try {
    const url = new URL(candidate);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return '';
    return url.toString();
  } catch {
    if (candidate.startsWith('http://') || candidate.startsWith('https://')) return candidate;
    return '';
  }
}

export function isValidEmbedInput(input: string): boolean {
  return extractEmbedSrc(input).length > 0;
}
