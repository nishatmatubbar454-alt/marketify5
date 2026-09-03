export function getTelegramLink(): string {
  return localStorage.getItem('mk-telegram-link') || 'https://t.me/telegram';
}

export function setTelegramLink(url: string) {
  localStorage.setItem('mk-telegram-link', url);
}

export function getContactLink(): string {
  return localStorage.getItem('mk-contact-link') || 'https://t.me/contact';
}

export function setContactLink(url: string) {
  localStorage.setItem('mk-contact-link', url);
}

export function getFavorites(): string[] {
  try {
    const raw = localStorage.getItem('mk-favorites');
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
}

export function toggleFavorite(id: string): boolean {
  const list = getFavorites();
  const idx = list.indexOf(id);
  let next: string[];
  if (idx >= 0) {
    next = list.filter((item) => item !== id);
  } else {
    next = [id, ...list];
  }
  localStorage.setItem('mk-favorites', JSON.stringify(next));
  return idx < 0;
}

export function getHistory(): string[] {
  try {
    const raw = localStorage.getItem('mk-history');
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
}

export function addHistory(id: string) {
  const list = getHistory().filter((item) => item !== id);
  const next = [id, ...list].slice(0, 50);
  localStorage.setItem('mk-history', JSON.stringify(next));
}

export function isDirectLink(url: string): boolean {
  const trimmed = (url || '').trim().toLowerCase();
  if (!trimmed) return false;
  if (
    trimmed.startsWith('<iframe') ||
    trimmed.includes('youtube.com') ||
    trimmed.includes('youtu.be') ||
    trimmed.includes('vimeo.com') ||
    trimmed.includes('dailymotion.com') ||
    trimmed.includes('facebook.com') ||
    trimmed.includes('drive.google.com')
  ) {
    return false;
  }
  const videoExtensions = ['.mp4', '.webm', '.ogg', '.mov', '.m3u8', '.mkv', '.avi', '.flv'];
  return videoExtensions.some((ext) => trimmed.split('?')[0].endsWith(ext));
}
