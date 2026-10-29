import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { AlertTriangleIcon, CheckCircle2Icon, ExternalLinkIcon, PencilIcon, Trash2Icon, XIcon, SmartphoneIcon } from 'lucide-react';
import { AdminLayout } from '../../components/admin/AdminLayout';
import { deleteVideo, saveVideo, useVideos } from '../../hooks/useVideos';
import { formatCount, timeAgo } from '../../utils/format';
import { useAppAnalytics } from '../../utils/analytics';
import type { Video } from '../../types';

export function Dashboard() {
  const { videos, loading, error } = useVideos();
  const analyticsStats = useAppAnalytics();
  const location = useLocation();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [deletingVideo, setDeletingVideo] = useState<Video | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const totalViews = videos.reduce((sum, v) => sum + (v.views || 0), 0);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  useEffect(() => {
    if (location.state && (location.state as { successMessage?: string }).successMessage) {
      showToast((location.state as { successMessage?: string }).successMessage!);
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

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
      {/* Toast */}
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
            className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl ring-1 ring-black/10 dark:bg-[#181818] dark:ring-white/10"
            role="dialog"
            aria-modal="true"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-full bg-red-100 text-red-600 dark:bg-red-950 dark:text-red-400">
                  <AlertTriangleIcon size={20} />
                </div>
                <div>
                  <h3 className="text-[16px] font-bold text-[#0f0f0f] dark:text-white">Delete Video</h3>
                  <p className="text-[12px] text-[#606060] dark:text-white/50">This action cannot be undone.</p>
                </div>
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

      <div className="mb-4 grid grid-cols-2 gap-2.5 sm:grid-cols-5">
        <Stat label="Total Videos" value={String(videos.length)} />
        <Stat label="Active Videos" value={String(videos.filter((v) => v.status === 'active').length)} />
        <Stat label="Total Views" value={formatCount(totalViews)} />
        <Stat
          label="মোট ডাউনলোড (Installs)"
          value={formatCount(analyticsStats.totalInstalls)}
          highlight
        />
        <Stat
          label="ফোনে ইনস্টল আছে (Devices)"
          value={formatCount(analyticsStats.installedPhonesCount)}
          highlight
        />
      </div>

      {/* Installed Devices & App Download Breakdown */}
      <div className="mb-4 rounded-xl border border-black/10 bg-white p-3.5 shadow-sm dark:border-white/10 dark:bg-panel">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-black/5 pb-2.5 dark:border-white/5">
          <div className="flex items-center gap-2">
            <SmartphoneIcon size={18} className="text-brand" />
            <span className="text-[13px] sm:text-[14px] font-bold text-[#0f0f0f] dark:text-white">
              অ্যাপ ডাউনলোড ও ইনস্টল ডিভাইস পরিসংখ্যান (Device Analytics)
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] font-medium">
            <span className="rounded-md bg-emerald-500/10 px-2 py-0.5 text-emerald-600 dark:text-emerald-400 font-bold">
              Android Phone: {analyticsStats.androidCount}
            </span>
            <span className="rounded-md bg-sky-500/10 px-2 py-0.5 text-sky-600 dark:text-sky-400 font-bold">
              iPhone (iOS): {analyticsStats.iosCount}
            </span>
            <span className="rounded-md bg-purple-500/10 px-2 py-0.5 text-purple-600 dark:text-purple-400 font-bold">
              অন্যান্য: {analyticsStats.desktopCount}
            </span>
          </div>
        </div>

        {analyticsStats.devices.length === 0 ? (
          <p className="pt-2.5 text-[12px] text-[#606060] dark:text-white/50 text-center">
            এখনো কোনো ডিভাইস রেকর্ড হয়নি। ব্যবহারকারীরা অ্যাপ ইনস্টল বা চালু করলেই এখানে তাদের ডিভাইসের তালিকা স্বয়ংক্রিয়ভাবে চলে আসবে।
          </p>
        ) : (
          <div className="mt-2.5 max-h-48 overflow-y-auto space-y-1.5 divide-y divide-black/5 dark:divide-white/5 text-[12px]">
            {analyticsStats.devices.map((device, idx) => (
              <div key={device.deviceId || idx} className="pt-1.5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[11px] text-[#808080]">#{idx + 1}</span>
                  <span className="font-semibold text-[#0f0f0f] dark:text-white">
                    {device.platform === 'iOS'
                      ? '🍏 iPhone / iPad'
                      : device.platform === 'Android'
                      ? '📱 Android Phone'
                      : '💻 Desktop / Other'}
                  </span>
                  <span className="font-mono text-[10px] text-[#808080] bg-black/5 dark:bg-white/10 px-1.5 py-0.5 rounded">
                    {device.deviceId?.substring(0, 10)}...
                  </span>
                </div>
                <div className="text-[11px] text-[#808080] flex items-center gap-2">
                  <span>সর্বশেষ সক্রিয়: {timeAgo(device.lastActiveAt)}</span>
                  <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" title="Active Device" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {error && (
        <p className="mb-3 rounded-lg bg-red-50 px-4 py-3 text-[13px] text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      )}

      {loading && <p className="text-[14px] text-[#606060] dark:text-white/50">Loading videos...</p>}

      {!loading && videos.length === 0 && (
        <div className="rounded-xl bg-white p-6 text-center dark:bg-panel">
          <p className="text-[14px] text-[#606060] dark:text-white/60">No videos found.</p>
          <Link to="/erfan/add" className="mt-2 inline-block text-[13px] font-semibold text-brand">
            Add your first video
          </Link>
        </div>
      )}

      <div className="space-y-2">
        {videos.map((video) => (
          <div
            key={video.id}
            className="flex items-center gap-3 rounded-lg bg-white p-2.5 shadow-sm ring-1 ring-black/5 dark:bg-panel dark:ring-white/5"
          >
            <div className="h-[52px] w-[92px] shrink-0 overflow-hidden rounded bg-black/5 dark:bg-white/10">
              {video.thumbnailUrl && (
                <img src={video.thumbnailUrl} alt="" className="h-full w-full object-cover" />
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
                  className="grid h-9 w-9 place-items-center rounded-md text-[#606060] hover:bg-black/5 dark:text-white/60 dark:hover:bg-white/10"
                >
                  <ExternalLinkIcon size={16} />
                </a>
              ) : (
                <Link
                  to={`/video/${video.id}`}
                  aria-label="Preview video"
                  className="grid h-9 w-9 place-items-center rounded-md text-[#606060] hover:bg-black/5 dark:text-white/60 dark:hover:bg-white/10"
                >
                  <ExternalLinkIcon size={16} />
                </Link>
              )}
              <Link
                to={`/erfan/edit/${video.id}`}
                aria-label="Edit video"
                className="grid h-9 w-9 place-items-center rounded-md text-[#606060] hover:bg-black/5 dark:text-white/60 dark:hover:bg-white/10"
              >
                <PencilIcon size={16} />
              </Link>
              <button
                type="button"
                onClick={() => onToggleStatus(video.id, video.status)}
                disabled={busyId === video.id}
                className="rounded-md bg-black/5 px-2.5 py-1.5 text-[12px] font-semibold text-[#0f0f0f] disabled:opacity-50 dark:bg-white/10 dark:text-white"
              >
                {video.status === 'active' ? 'Disable' : 'Enable'}
              </button>
              <button
                type="button"
                onClick={() => setDeletingVideo(video)}
                disabled={busyId === video.id}
                aria-label="Delete video"
                className="grid h-9 w-9 place-items-center rounded-md text-red-600 hover:bg-red-50 disabled:opacity-50 dark:hover:bg-red-950"
              >
                <Trash2Icon size={16} />
              </button>
            </div>
          </div>
        ))}
      </div>
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
