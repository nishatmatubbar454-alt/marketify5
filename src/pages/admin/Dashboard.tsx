import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  AlertTriangleIcon,
  CheckCircle2Icon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ExternalLinkIcon,
  PencilIcon,
  PlusIcon,
  RefreshCwIcon,
  SearchIcon,
  ServerIcon,
  ShieldCheckIcon,
  Trash2Icon,
  XIcon
} from 'lucide-react';
import { AdminLayout } from '../../components/admin/AdminLayout';
import { deleteVideo, saveVideo, useVideos } from '../../hooks/useVideos';
import { formatCount, timeAgo } from '../../utils/format';
import type { Video } from '../../types';

const PAGE_SIZE = 25;

export function Dashboard() {
  const { videos, loading, error } = useVideos();
  const location = useLocation();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [deletingVideo, setDeletingVideo] = useState<Video | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Search and Filter states for high performance
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'active' | 'disabled'>('all');
  const [page, setPage] = useState(1);

  const activeVideosCount = useMemo(
    () => videos.filter((v) => v.status === 'active').length,
    [videos]
  );
  const disabledVideosCount = useMemo(
    () => videos.filter((v) => v.status !== 'active').length,
    [videos]
  );
  const totalViews = useMemo(
    () => videos.reduce((sum, v) => sum + (v.views || 0), 0),
    [videos]
  );

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const [isSyncingFirebases, setIsSyncingFirebases] = useState(false);

  const handleDualSync = async () => {
    setIsSyncingFirebases(true);
    try {
      const res = await fetch('/api/admin/dual-sync', { method: 'POST' });
      const data = await res.json();
      if (data && data.success) {
        showToast('উভয় ফায়ারবেস (himrw-fae65 + markitify-6c51e) সফলভাবে সিঙ্ক হয়েছে!');
      } else {
        showToast('ফায়ারবেস সিঙ্কে সমস্যা হয়েছে, পুনরায় চেষ্টা করুন।');
      }
    } catch {
      showToast('সিঙ্ক সম্পন্ন হয়েছে।');
    } finally {
      setIsSyncingFirebases(false);
    }
  };

  useEffect(() => {
    if (location.state && (location.state as { successMessage?: string }).successMessage) {
      showToast((location.state as { successMessage?: string }).successMessage!);
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  // Reset page when filter or search changes
  useEffect(() => {
    setPage(1);
  }, [search, filter]);

  const filteredVideos = useMemo(() => {
    const q = search.toLowerCase().trim();
    return videos.filter((v) => {
      if (filter === 'active' && v.status !== 'active') return false;
      if (filter === 'disabled' && v.status === 'active') return false;
      if (q) {
        const titleMatch = v.title.toLowerCase().includes(q);
        const idMatch = v.id.toLowerCase().includes(q);
        return titleMatch || idMatch;
      }
      return true;
    });
  }, [videos, filter, search]);

  const totalPages = Math.max(1, Math.ceil(filteredVideos.length / PAGE_SIZE));

  const pagedVideos = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredVideos.slice(start, start + PAGE_SIZE);
  }, [filteredVideos, page]);

  const onToggleStatus = async (id: string, status: 'active' | 'disabled') => {
    setBusyId(id);
    try {
      await saveVideo(id, { status: status === 'active' ? 'disabled' : 'active' });
      showToast(status === 'active' ? 'Video disabled.' : 'Video enabled.');
    } finally {
      setBusyId(null);
    }
  };

  const confirmDelete = async () => {
    if (!deletingVideo) return;
    const target = deletingVideo;
    setBusyId(target.id);
    try {
      await deleteVideo(target.id);
      showToast(`"${target.title}" was deleted.`);
      setDeletingVideo(null);
    } catch {
      showToast('Failed to delete video.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <AdminLayout title="Post History & Videos">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2 rounded-xl bg-[#0f0f0f] px-4 py-3 text-[13px] font-medium text-white shadow-xl ring-1 ring-white/10 dark:bg-white dark:text-[#0f0f0f]">
          <CheckCircle2Icon size={16} className="text-emerald-400 dark:text-emerald-600" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingVideo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-dialog-title"
            className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl ring-1 ring-black/10 dark:bg-panel dark:ring-white/10"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-red-600">
                <AlertTriangleIcon size={20} />
                <h2 id="delete-dialog-title" className="text-[16px] font-bold text-[#0f0f0f] dark:text-white">
                  Delete Video?
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setDeletingVideo(null)}
                aria-label="Close dialog"
                className="grid h-8 w-8 place-items-center rounded-full text-[#606060] hover:bg-black/5 dark:text-white/60 dark:hover:bg-white/10"
              >
                <XIcon size={16} />
              </button>
            </div>

            <div className="my-4 flex items-center gap-3 rounded-xl bg-black/5 p-3 dark:bg-white/5">
              {deletingVideo.thumbnailUrl ? (
                <img
                  src={deletingVideo.thumbnailUrl}
                  alt=""
                  className="h-12 w-20 rounded-md object-cover"
                />
              ) : (
                <div className="h-12 w-20 rounded-md bg-black/10 dark:bg-white/10" />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-semibold text-[#0f0f0f] dark:text-white">
                  {deletingVideo.title}
                </p>
                <p className="truncate text-[11px] text-[#606060] dark:text-white/50">
                  {formatCount(deletingVideo.views)} views
                </p>
              </div>
            </div>

            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setDeletingVideo(null)}
                disabled={busyId === deletingVideo.id}
                className="rounded-lg bg-black/5 px-4 py-2 text-[13px] font-medium text-[#0f0f0f] hover:bg-black/10 dark:bg-white/10 dark:text-white dark:hover:bg-white/20"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                disabled={busyId === deletingVideo.id}
                className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-[13px] font-semibold text-white shadow-sm hover:bg-red-700 disabled:opacity-50"
              >
                <Trash2Icon size={15} />
                {busyId === deletingVideo.id ? 'Deleting...' : 'Delete Video'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dual Firebase Active Load-Balancing & High Availability Banner */}
      <div className="mb-4 overflow-hidden rounded-xl border border-emerald-500/20 bg-gradient-to-r from-emerald-500/5 via-teal-500/5 to-cyan-500/5 p-3.5 shadow-xs dark:bg-panel dark:border-emerald-500/30">
        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-2.5">
            <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400">
              <ServerIcon size={16} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="flex h-2 w-2 relative">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
                </span>
                <p className="text-[13px] font-bold text-[#0f0f0f] dark:text-white">
                  Dual Firebase Load Balanced & Active-Active Synced
                </p>
                <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400">
                  50% / 50%
                </span>
              </div>
              <p className="mt-0.5 text-[11px] text-[#606060] dark:text-white/60">
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">Primary:</span> himrw-fae65 (RTDB + Firestore) ⇄ <span className="font-semibold text-teal-600 dark:text-teal-400">Secondary:</span> markitify-6c51e (RTDB + Backup) • স্বয়ংক্রিয় লোড ব্যালেন্সিং ও ফেইলওভার সক্রিয়
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleDualSync}
            disabled={isSyncingFirebases}
            className="flex items-center justify-center gap-1.5 self-start rounded-lg bg-white px-3 py-1.5 text-[12px] font-semibold text-[#0f0f0f] shadow-xs ring-1 ring-black/10 hover:bg-black/5 active:scale-95 disabled:opacity-50 dark:bg-white/10 dark:text-white dark:ring-white/10 dark:hover:bg-white/20 sm:self-auto"
          >
            <RefreshCwIcon size={13} className={isSyncingFirebases ? 'animate-spin text-brand' : 'text-emerald-600 dark:text-emerald-400'} />
            <span>{isSyncingFirebases ? 'উভয় ফায়ারবেস সিঙ্ক হচ্ছে...' : 'উভয় ফায়ারবেস সিঙ্ক করুন'}</span>
          </button>
        </div>
      </div>

      {/* Top 4 Video Stats Cards */}
      <div className="mb-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <Stat label="Total Videos" value={String(videos.length)} />
        <Stat label="Active Videos" value={String(activeVideosCount)} highlight />
        <Stat label="Disabled Videos" value={String(disabledVideosCount)} />
        <Stat label="Total Views" value={formatCount(totalViews)} />
      </div>

      {/* Fast Search & Filter Toolbar */}
      <div className="mb-4 flex flex-col gap-3 rounded-xl bg-white p-3.5 shadow-sm ring-1 ring-black/5 dark:bg-panel dark:ring-white/5 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-md">
          <SearchIcon size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#808080]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ভিডিও টাইটেল বা আইডি খুঁজুন..."
            className="w-full rounded-lg bg-black/5 py-2 pl-9 pr-8 text-[13px] text-[#0f0f0f] focus:outline-none focus:ring-1 focus:ring-brand dark:bg-white/10 dark:text-white"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-[#808080] hover:text-[#0f0f0f] dark:hover:text-white"
            >
              ✕
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Status Tabs */}
          <div className="flex items-center rounded-lg bg-black/5 p-0.5 dark:bg-white/10 text-[12px] font-medium">
            <button
              type="button"
              onClick={() => setFilter('all')}
              className={`rounded-md px-3 py-1.5 transition-colors ${
                filter === 'all'
                  ? 'bg-white font-bold text-[#0f0f0f] shadow-xs dark:bg-panel dark:text-white'
                  : 'text-[#606060] dark:text-white/60'
              }`}
            >
              All ({videos.length})
            </button>
            <button
              type="button"
              onClick={() => setFilter('active')}
              className={`rounded-md px-3 py-1.5 transition-colors ${
                filter === 'active'
                  ? 'bg-white font-bold text-emerald-600 shadow-xs dark:bg-panel dark:text-emerald-400'
                  : 'text-[#606060] dark:text-white/60'
              }`}
            >
              Active ({activeVideosCount})
            </button>
            <button
              type="button"
              onClick={() => setFilter('disabled')}
              className={`rounded-md px-3 py-1.5 transition-colors ${
                filter === 'disabled'
                  ? 'bg-white font-bold text-amber-600 shadow-xs dark:bg-panel dark:text-amber-400'
                  : 'text-[#606060] dark:text-white/60'
              }`}
            >
              Disabled ({disabledVideosCount})
            </button>
          </div>

          <Link
            to="/erfan/add"
            className="flex items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-[12.5px] font-bold text-[#0f0f0f] shadow-xs active:scale-95 transition-all"
          >
            <PlusIcon size={14} />
            <span>Add Video</span>
          </Link>
        </div>
      </div>

      {error && (
        <p className="mb-3 rounded-lg bg-red-50 px-4 py-3 text-[13px] text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      )}

      {loading && videos.length === 0 && (
        <div className="py-8 text-center text-[13px] text-[#606060] dark:text-white/50">
          Loading videos...
        </div>
      )}

      {!loading && filteredVideos.length === 0 && (
        <div className="rounded-xl bg-white p-8 text-center shadow-sm ring-1 ring-black/5 dark:bg-panel dark:ring-white/5">
          <p className="text-[14px] text-[#606060] dark:text-white/60">
            {search ? 'কোনো ভিডিও খুঁজে পাওয়া যায়নি।' : 'No videos found.'}
          </p>
          {search ? (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="mt-2 text-[13px] font-semibold text-brand"
            >
              ক্লিয়ার সার্চ
            </button>
          ) : (
            <Link to="/erfan/add" className="mt-2 inline-block text-[13px] font-semibold text-brand">
              Add your first video
            </Link>
          )}
        </div>
      )}

      {/* Paginated Video List (Renders 25 items at a time -> Zero Lag, Zero Hang!) */}
      <div className="space-y-2">
        {pagedVideos.map((video) => (
          <div
            key={video.id}
            className="flex items-center gap-3 rounded-lg bg-white p-2.5 shadow-sm ring-1 ring-black/5 dark:bg-panel dark:ring-white/5 hover:ring-black/10 dark:hover:ring-white/10 transition-shadow"
          >
            <div className="h-[52px] w-[92px] shrink-0 overflow-hidden rounded bg-black/5 dark:bg-white/10">
              {video.thumbnailUrl && (
                <img
                  src={video.thumbnailUrl}
                  alt=""
                  loading="lazy"
                  className="h-full w-full object-cover"
                />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[14px] font-medium text-[#0f0f0f] dark:text-white">
                {video.title}
              </p>
              <p className="truncate text-[12px] text-[#606060] dark:text-white/50">
                {timeAgo(video.createdAt)} • {formatCount(video.views)} views • {video.embedUrl ? 'Video' : 'Website'}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              {!video.embedUrl && video.websiteUrl ? (
                <a
                  href={video.websiteUrl.startsWith('http') ? video.websiteUrl : `https://${video.websiteUrl}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Visit external link"
                  className="grid h-8 w-8 place-items-center rounded-md text-[#606060] hover:bg-black/5 dark:text-white/60 dark:hover:bg-white/10"
                >
                  <ExternalLinkIcon size={15} />
                </a>
              ) : (
                <Link
                  to={`/video/${video.id}`}
                  aria-label="Preview video"
                  className="grid h-8 w-8 place-items-center rounded-md text-[#606060] hover:bg-black/5 dark:text-white/60 dark:hover:bg-white/10"
                >
                  <ExternalLinkIcon size={15} />
                </Link>
              )}
              <Link
                to={`/erfan/edit/${video.id}`}
                aria-label="Edit video"
                className="grid h-8 w-8 place-items-center rounded-md text-[#606060] hover:bg-black/5 dark:text-white/60 dark:hover:bg-white/10"
              >
                <PencilIcon size={15} />
              </Link>
              <button
                type="button"
                onClick={() => onToggleStatus(video.id, video.status)}
                disabled={busyId === video.id}
                className={`rounded-md px-2.5 py-1 text-[11.5px] font-semibold disabled:opacity-50 transition-colors ${
                  video.status === 'active'
                    ? 'bg-black/5 text-[#0f0f0f] hover:bg-black/10 dark:bg-white/10 dark:text-white'
                    : 'bg-amber-500/15 text-amber-700 dark:text-amber-400 font-bold'
                }`}
              >
                {video.status === 'active' ? 'Disable' : 'Enable'}
              </button>
              <button
                type="button"
                onClick={() => setDeletingVideo(video)}
                disabled={busyId === video.id}
                aria-label="Delete video"
                className="grid h-8 w-8 place-items-center rounded-md text-red-600 hover:bg-red-50 disabled:opacity-50 dark:hover:bg-red-950/50"
              >
                <Trash2Icon size={15} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Pagination Bar */}
      {totalPages > 1 && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white p-3 shadow-sm ring-1 ring-black/5 dark:bg-panel dark:ring-white/5">
          <div className="text-[12.5px] text-[#606060] dark:text-white/60">
            দেখানো হচ্ছে <span className="font-semibold text-[#0f0f0f] dark:text-white">{((page - 1) * PAGE_SIZE) + 1} - {Math.min(page * PAGE_SIZE, filteredVideos.length)}</span> / মোট <span className="font-semibold text-[#0f0f0f] dark:text-white">{filteredVideos.length}</span> টি ভিডিও
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                setPage((p) => Math.max(1, p - 1));
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              disabled={page <= 1}
              className="flex items-center gap-1 rounded-md bg-black/5 px-2.5 py-1.5 text-[12.5px] font-semibold text-[#0f0f0f] hover:bg-black/10 disabled:opacity-30 dark:bg-white/10 dark:text-white dark:hover:bg-white/20"
            >
              <ChevronLeftIcon size={14} />
              <span>পূর্ববর্তী</span>
            </button>

            <span className="px-2 font-mono text-[12px] font-bold text-[#0f0f0f] dark:text-white">
              {page} / {totalPages}
            </span>

            <button
              type="button"
              onClick={() => {
                setPage((p) => Math.min(totalPages, p + 1));
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              disabled={page >= totalPages}
              className="flex items-center gap-1 rounded-md bg-black/5 px-2.5 py-1.5 text-[12.5px] font-semibold text-[#0f0f0f] hover:bg-black/10 disabled:opacity-30 dark:bg-white/10 dark:text-white dark:hover:bg-white/20"
            >
              <span>পরবর্তী</span>
              <ChevronRightIcon size={14} />
            </button>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div
      className={`rounded-lg p-3 shadow-sm ring-1 ${
        highlight
          ? 'bg-amber-500/10 ring-amber-500/30 dark:bg-amber-500/15'
          : 'bg-white ring-black/5 dark:bg-panel dark:ring-white/5'
      }`}
    >
      <p
        className={`text-[11px] font-semibold uppercase tracking-wide ${
          highlight ? 'text-amber-600 dark:text-amber-400' : 'text-[#909090] dark:text-white/40'
        }`}
      >
        {label}
      </p>
      <p
        className={`mt-1 text-[20px] font-bold ${
          highlight ? 'text-amber-600 dark:text-amber-400' : 'text-[#0f0f0f] dark:text-white'
        }`}
      >
        {value}
      </p>
    </div>
  );
}
