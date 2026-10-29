export function formatCount(n: number): string {
  const v = Math.max(0, Math.floor(Number(n) || 0));
  if (v >= 1_000_000) {
    const val = v / 1_000_000;
    const formatted = val >= 100 ? Math.round(val).toString() : val.toFixed(1).replace(/\.0$/, '');
    return `${formatted}M`;
  }
  if (v >= 1000) {
    const val = v / 1000;
    if (val >= 999.95) {
      return '1M';
    }
    const formatted = val >= 100 ? Math.round(val).toString() : val.toFixed(1).replace(/\.0$/, '');
    return `${formatted}k`;
  }
  return String(v);
}

export function formatViews(views: number): string {
  const n = Math.max(0, Math.floor(Number(views) || 0));
  const countStr = formatCount(n);
  return `${countStr} ${n === 1 ? 'view' : 'views'}`;
}

export function timeAgo(timestamp: number): string {
  if (!timestamp) return 'just now';
  const seconds = Math.max(1, Math.floor((Date.now() - timestamp) / 1000));
  const units: [number, string][] = [
    [31536000, 'year'],
    [2592000, 'month'],
    [604800, 'week'],
    [86400, 'day'],
    [3600, 'hour'],
    [60, 'minute']
  ];
  for (const [secs, label] of units) {
    const value = Math.floor(seconds / secs);
    if (value >= 1) return `${value} ${label}${value > 1 ? 's' : ''} ago`;
  }
  return 'just now';
}
