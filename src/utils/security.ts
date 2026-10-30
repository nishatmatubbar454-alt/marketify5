/**
 * Data Protection & Security Rules
 * 1. 30-Day Immortality Rule: Data older than 30 days from creation cannot be deleted by anyone.
 * 2. 30-Day Recycle Bin Retention: Trashed items stay in Recycle Bin up to 30 days for restoration.
 * 3. Never-delete Firebase protection: Underlying data is archived, never destroyed.
 */

export const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export function isPermanentlyLocked(video: { createdAt?: number; updatedAt?: number } | null | undefined): boolean {
  if (!video) return false;
  const ts = video.createdAt || video.updatedAt || 0;
  if (!ts) return false;
  return Date.now() - ts > THIRTY_DAYS_MS;
}

export function getDaysUntilLock(video: { createdAt?: number; updatedAt?: number } | null | undefined): number {
  if (!video) return 0;
  const ts = video.createdAt || video.updatedAt || 0;
  if (!ts) return 0;
  const remainingMs = Math.max(0, THIRTY_DAYS_MS - (Date.now() - ts));
  return Math.ceil(remainingMs / (24 * 60 * 60 * 1000));
}

export function getDaysLeftInTrash(video: { deletedAt?: number } | null | undefined): number {
  if (!video) return 0;
  const ts = video.deletedAt || Date.now();
  const remainingMs = Math.max(0, THIRTY_DAYS_MS - (Date.now() - ts));
  return Math.ceil(remainingMs / (24 * 60 * 60 * 1000));
}
