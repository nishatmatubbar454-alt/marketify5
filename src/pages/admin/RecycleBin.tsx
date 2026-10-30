import React, { useMemo, useState } from 'react';
import {
  AlertTriangleIcon,
  CheckCircle2Icon,
  ChevronLeftIcon,
  ChevronRightIcon,
  RotateCcwIcon,
  SearchIcon,
  ShieldCheckIcon,
  Trash2Icon
} from 'lucide-react';
import { AdminLayout } from '../../components/admin/AdminLayout';
import { restoreVideo, useVideos } from '../../hooks/useVideos';
import { formatCount, timeAgo } from '../../utils/format';
import { getDaysLeftInTrash } from '../../utils/security';
import type { Video } from '../../types';

const PAGE_SIZE = 25;

export function RecycleBin() {
  const { videos, loading } = useVideos();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Only trashed videos
  const trashedVideos = useMemo(() => {
    return videos.filter((v) => v.status === 'trashed');
  }, [videos]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return trashedVideos;
    return trashedVideos.filter((v) => {
      const matchTitle = v.title.toLowerCase().includes(q);
      const matchId = v.id.toLowerCase().includes(q);
      return matchTitle || matchId;
    });
  }, [trashedVideos, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pagedVideos = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, page]);

  const handleRestore = async (video: Video) => {
    setBusyId(video.id);
    try {
      await restoreVideo(video.id);
      showToast(`"${video.title}" সফলভাবে পুনরুদ্ধার করা হয়েছে!`);
    } catch {
      showToast('পুনরুদ্ধার করতে সমস্যা হয়েছে। আবার চেষ্টা করুন।');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <AdminLayout title="রিসাইকেল বিন (Recycle Bin)">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2 rounded-xl bg-[#0f0f0f] px-4 py-3 text-[13px] font-medium text-white shadow-xl ring-1 ring-white/10 dark:bg-white dark:text-[#0f0f0f]">
          <CheckCircle2Icon size={16} className="text-emerald-400 dark:text-emerald-600" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* 30-Day Permanent Lock & Recycle Bin Security Policy Banner */}
      <div className="mb-4 overflow-hidden rounded-xl border border-amber-500/30 bg-gradient-to-r from-amber-500/10 via-orange-500/5 to-amber-500/10 p-4 shadow-xs dark:bg-panel dark:border-amber-500/30">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/20 text-amber-600 dark:text-amber-400">
            <ShieldCheckIcon size={20} />
          </div>
          <div className="flex-1 text-[13px] text-[#0f0f0f] dark:text-white">
            <h2 className="font-bold text-[14px] flex items-center gap-2 text-amber-700 dark:text-amber-400">
              ডাটা নিরাপত্তা ও ৩০ দিনের রিসাইকেল বিন নীতি
            </h2>
            <div className="mt-1.5 space-y-1 text-[12px] text-[#606060] dark:text-white/70">
              <p>
                • <strong>স্থায়ী ডাটা সুরক্ষা:</strong> ইম্পোর্ট বা আপলোড করা ভিডিও ৩০ দিনের মধ্যে ডিলিট না করা হলে তা <strong>চিরস্থায়ী লক</strong> হয়ে যায় — এরপর কোনো এডমিন তা আর ফায়ারবেস থেকে ডিলিট করতে পারবেন না।
              </p>
              <p>
                • <strong>৩০ দিন জমা থাকা:</strong> কোনো ভিডিও ডিলিট করা হলে তা সরাসরি মুছে যায় না, বরং ৩০ দিন পর্যন্ত এই রিসাইকেল বিনে জমা থাকে।
              </p>
              <p>
                • <strong>পুনরুদ্ধার সুবিধা:</strong> যেকোনো সময় <strong>'পুনরুদ্ধার' (Restore)</strong> বাটনে ক্লিক করে ভিডিওটি আবার সক্রিয় (Active) অবস্থায় মূল সাইটে ফেরত নিতে পারবেন।
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Summary */}
      <div className="mb-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        <div className="rounded-xl bg-white p-3.5 shadow-sm ring-1 ring-black/5 dark:bg-panel dark:ring-white/5">
          <p className="text-[11px] font-semibold text-[#808080]">রিসাইকেল বিনে মোট ভিডিও</p>
          <p className="mt-1 text-2xl font-bold text-amber-600 dark:text-amber-400">{trashedVideos.length}</p>
        </div>
        <div className="rounded-xl bg-white p-3.5 shadow-sm ring-1 ring-black/5 dark:bg-panel dark:ring-white/5">
          <p className="text-[11px] font-semibold text-[#808080]">জমা থাকার মেয়াদ</p>
          <p className="mt-1 text-2xl font-bold text-[#0f0f0f] dark:text-white">৩০ দিন</p>
        </div>
        <div className="col-span-2 rounded-xl bg-white p-3.5 shadow-sm ring-1 ring-black/5 dark:bg-panel dark:ring-white/5 sm:col-span-1">
          <p className="text-[11px] font-semibold text-[#808080]">ফায়ারবেস স্ট্যাটাস</p>
          <p className="mt-1 text-[13px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            উভয় ফায়ারবেসে সংরক্ষিত
          </p>
        </div>
      </div>

      {/* Search Toolbar */}
      <div className="mb-4 flex items-center justify-between rounded-xl bg-white p-3 shadow-sm ring-1 ring-black/5 dark:bg-panel dark:ring-white/5">
        <div className="relative flex-1 max-w-md">
          <SearchIcon size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#808080]" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="রিসাইকেল বিনে ভিডিও খুঁজুন..."
            className="w-full rounded-lg bg-black/5 py-2 pl-9 pr-4 text-[13px] text-[#0f0f0f] focus:outline-none focus:ring-1 focus:ring-amber-500 dark:bg-white/10 dark:text-white"
          />
        </div>
        <p className="text-xs text-[#808080]">
          ফলাফল: <span className="font-bold text-[#0f0f0f] dark:text-white">{filtered.length}</span> টি
        </p>
      </div>

      {/* Videos List */}
      {loading && filtered.length === 0 ? (
        <div className="py-16 text-center text-sm text-[#808080]">
          <div className="mx-auto mb-2 h-7 w-7 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
          রিসাইকেল বিন লোড হচ্ছে...
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-black/10 bg-white/50 p-12 text-center dark:border-white/10 dark:bg-panel/50">
          <Trash2Icon size={36} className="mx-auto text-[#808080]/50" />
          <h3 className="mt-3 text-[15px] font-bold text-[#0f0f0f] dark:text-white">
            রিসাইকেল বিন সম্পূর্ণ খালি
          </h3>
          <p className="mt-1 text-xs text-[#808080]">
            বর্তমানে কোনো ভিডিও রিসাইকেল বিনে জমা নেই।
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {pagedVideos.map((video) => {
            const daysLeft = getDaysLeftInTrash(video);
            return (
              <div
                key={video.id}
                className="flex flex-col gap-3 rounded-xl bg-white p-3.5 shadow-xs ring-1 ring-black/5 dark:bg-panel dark:ring-white/5 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  {video.thumbnailUrl ? (
                    <img
                      src={video.thumbnailUrl}
                      alt=""
                      className="h-14 w-24 shrink-0 rounded-lg object-cover bg-black/5"
                    />
                  ) : (
                    <div className="h-14 w-24 shrink-0 rounded-lg bg-black/10 dark:bg-white/10" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-semibold text-[#0f0f0f] dark:text-white">
                      {video.title}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-[#808080]">
                      <span>{formatCount(video.views)} ভিউ</span>
                      <span>•</span>
                      <span>ডিলিট হয়েছে: {timeAgo(video.deletedAt || video.updatedAt)}</span>
                      <span>•</span>
                      <span className="rounded-full bg-amber-500/10 px-2 py-0.5 font-semibold text-amber-700 dark:bg-amber-500/20 dark:text-amber-400">
                        বাকি আছে {daysLeft} দিন
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center">
                  <button
                    type="button"
                    onClick={() => handleRestore(video)}
                    disabled={busyId === video.id}
                    className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-1.5 text-[12px] font-semibold text-white shadow-xs transition hover:bg-emerald-700 active:scale-95 disabled:opacity-50"
                  >
                    <RotateCcwIcon size={14} className={busyId === video.id ? 'animate-spin' : ''} />
                    <span>{busyId === video.id ? 'পুনরুদ্ধার হচ্ছে...' : 'পুনরুদ্ধার করুন (Restore)'}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between rounded-xl bg-white px-4 py-3 shadow-sm ring-1 ring-black/5 dark:bg-panel dark:ring-white/5">
          <p className="text-[12px] text-[#808080]">
            পৃষ্ঠা <span className="font-bold text-[#0f0f0f] dark:text-white">{page}</span> / {totalPages}
          </p>
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="grid h-8 w-8 place-items-center rounded-lg border border-black/10 hover:bg-black/5 disabled:opacity-40 dark:border-white/10 dark:hover:bg-white/5"
            >
              <ChevronLeftIcon size={16} />
            </button>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="grid h-8 w-8 place-items-center rounded-lg border border-black/10 hover:bg-black/5 disabled:opacity-40 dark:border-white/10 dark:hover:bg-white/5"
            >
              <ChevronRightIcon size={16} />
            </button>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
