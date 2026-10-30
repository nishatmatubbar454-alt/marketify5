import React, { useState, useMemo } from 'react';
import {
  SmartphoneIcon,
  DownloadIcon,
  LaptopIcon,
  SearchIcon,
  RefreshCwIcon,
  CheckCircle2Icon,
  CopyIcon,
  FilterIcon,
  ShieldCheckIcon
} from 'lucide-react';
import { AdminLayout } from '../../components/admin/AdminLayout';
import { useAppAnalytics, InstalledDevice } from '../../utils/analytics';
import { timeAgo, formatCount } from '../../utils/format';

export function DeviceAnalytics() {
  const stats = useAppAnalytics();
  const [searchTerm, setSearchTerm] = useState('');
  const [platformFilter, setPlatformFilter] = useState<'All' | 'Android' | 'iOS' | 'Desktop'>('All');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const handleCopy = (id: string) => {
    navigator.clipboard?.writeText(id).catch(() => {});
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleRefresh = () => {
    setRefreshing(true);
    setTimeout(() => {
      setRefreshing(false);
    }, 600);
  };

  const filteredDevices = useMemo(() => {
    return stats.devices.filter((device) => {
      if (platformFilter !== 'All' && device.platform !== platformFilter) {
        return false;
      }
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase().trim();
        const devId = (device.deviceId || '').toLowerCase();
        const platform = (device.platform || '').toLowerCase();
        return devId.includes(query) || platform.includes(query);
      }
      return true;
    });
  }, [stats.devices, platformFilter, searchTerm]);

  return (
    <AdminLayout title="App Installs & Devices">
      {/* Page Header & Refresh */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[18px] sm:text-[20px] font-bold text-[#0f0f0f] dark:text-white flex items-center gap-2">
            <SmartphoneIcon className="h-6 w-6 text-brand" />
            অ্যাপ ডাউনলোড ও ডিভাইস পরিসংখ্যান
          </h1>
          <p className="mt-0.5 text-[12.5px] text-[#606060] dark:text-white/60">
            কতজন ইউজার অ্যাপ ডাউনলোড করেছেন এবং বর্তমানে কতটি ফোনে অ্যাপটি ইনস্টল আছে তার লাইভ ট্র্যাকিং।
          </p>
        </div>
        <button
          type="button"
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-1.5 rounded-lg bg-black/5 px-3 py-2 text-[12.5px] font-semibold text-[#0f0f0f] hover:bg-black/10 dark:bg-white/10 dark:text-white dark:hover:bg-white/20 active:scale-95 transition-all"
        >
          <RefreshCwIcon size={14} className={refreshing ? 'animate-spin' : ''} />
          <span>{refreshing ? 'রিফ্রেশ হচ্ছে...' : 'রিফ্রেশ করুন'}</span>
        </button>
      </div>

      {/* Top 5 Key Statistics Cards */}
      <div className="mb-5 grid grid-cols-2 gap-2.5 sm:grid-cols-5">
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 shadow-sm dark:bg-amber-500/15">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
              মোট ডাউনলোড
            </span>
            <DownloadIcon size={16} className="text-amber-600 dark:text-amber-400" />
          </div>
          <p className="mt-1.5 text-[24px] sm:text-[26px] font-extrabold text-amber-700 dark:text-amber-400">
            {stats.loading ? '...' : stats.totalInstalls}
          </p>
          <p className="mt-0.5 text-[11px] text-amber-800/80 dark:text-amber-300/80">
            Total App Installs
          </p>
        </div>

        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 shadow-sm dark:bg-emerald-500/15">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
              ফোনে ইনস্টল আছে
            </span>
            <SmartphoneIcon size={16} className="text-emerald-600 dark:text-emerald-400" />
          </div>
          <p className="mt-1.5 text-[24px] sm:text-[26px] font-extrabold text-emerald-700 dark:text-emerald-400">
            {stats.loading ? '...' : stats.installedPhonesCount}
          </p>
          <p className="mt-0.5 text-[11px] text-emerald-800/80 dark:text-emerald-300/80">
            Active Devices
          </p>
        </div>

        <div className="rounded-xl border border-black/5 bg-white p-3.5 shadow-sm dark:border-white/5 dark:bg-panel">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#606060] dark:text-white/60">
              Android Phones
            </span>
            <span className="text-[14px]">📱</span>
          </div>
          <p className="mt-1.5 text-[24px] sm:text-[26px] font-extrabold text-emerald-600 dark:text-emerald-400">
            {stats.loading ? '...' : stats.androidCount}
          </p>
          <p className="mt-0.5 text-[11px] text-[#808080]">
            অ্যান্ড্রয়েড ফোন
          </p>
        </div>

        <div className="rounded-xl border border-black/5 bg-white p-3.5 shadow-sm dark:border-white/5 dark:bg-panel">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#606060] dark:text-white/60">
              iPhone (iOS)
            </span>
            <span className="text-[14px]">🍏</span>
          </div>
          <p className="mt-1.5 text-[24px] sm:text-[26px] font-extrabold text-sky-600 dark:text-sky-400">
            {stats.loading ? '...' : stats.iosCount}
          </p>
          <p className="mt-0.5 text-[11px] text-[#808080]">
            আইফোন ডিভাইস
          </p>
        </div>

        <div className="rounded-xl border border-black/5 bg-white p-3.5 shadow-sm dark:border-white/5 dark:bg-panel">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#606060] dark:text-white/60">
              Desktop / Other
            </span>
            <LaptopIcon size={16} className="text-purple-600 dark:text-purple-400" />
          </div>
          <p className="mt-1.5 text-[24px] sm:text-[26px] font-extrabold text-purple-600 dark:text-purple-400">
            {stats.loading ? '...' : stats.desktopCount}
          </p>
          <p className="mt-0.5 text-[11px] text-[#808080]">
            কম্পিউটার ও ব্রাউজার
          </p>
        </div>
      </div>

      {/* Device Filter & Search Card */}
      <div className="rounded-xl border border-black/10 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-panel">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-black/5 pb-3 dark:border-white/5">
          {/* Search Box */}
          <div className="relative flex-1 max-w-md">
            <SearchIcon size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#808080]" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="ডিভাইস আইডি বা প্ল্যাটফর্ম খুঁজুন..."
              className="w-full rounded-lg bg-black/5 py-2 pl-9 pr-3 text-[13px] text-[#0f0f0f] focus:outline-none focus:ring-1 focus:ring-brand dark:bg-white/10 dark:text-white"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-[#808080] hover:text-[#0f0f0f] dark:hover:text-white"
              >
                ✕
              </button>
            )}
          </div>

          {/* Platform Filter Buttons */}
          <div className="flex flex-wrap items-center gap-1.5 text-[12px]">
            <span className="text-[#808080] flex items-center gap-1 mr-1">
              <FilterIcon size={12} /> ফিল্টার:
            </span>
            {(['All', 'Android', 'iOS', 'Desktop'] as const).map((filter) => (
              <button
                key={filter}
                type="button"
                onClick={() => setPlatformFilter(filter)}
                className={`rounded-md px-2.5 py-1 font-semibold transition-colors ${
                  platformFilter === filter
                    ? 'bg-[#0f0f0f] text-white dark:bg-white dark:text-[#0f0f0f]'
                    : 'bg-black/5 text-[#404040] hover:bg-black/10 dark:bg-white/10 dark:text-white/70'
                }`}
              >
                {filter === 'All' ? 'সব ডিভাইস' : filter}
              </button>
            ))}
          </div>
        </div>

        {/* Device List */}
        {stats.loading ? (
          <div className="py-12 text-center text-[13px] text-[#808080]">
            <RefreshCwIcon size={22} className="mx-auto mb-2 animate-spin text-brand" />
            ডিভাইস ডাটা লোড হচ্ছে...
          </div>
        ) : filteredDevices.length === 0 ? (
          <div className="py-12 text-center">
            <SmartphoneIcon size={32} className="mx-auto mb-2 text-[#808080]/50" />
            <p className="text-[14px] font-semibold text-[#0f0f0f] dark:text-white">
              কোনো ডিভাইস পাওয়া যায়নি
            </p>
            <p className="mt-1 text-[12px] text-[#808080]">
              ব্যবহারকারীরা অ্যাপ ডাউনলোড বা চালু করলেই স্বয়ংক্রিয়ভাবে তালিকা তৈরি হবে।
            </p>
          </div>
        ) : (
          <div className="mt-3 divide-y divide-black/5 dark:divide-white/5">
            <div className="hidden sm:grid grid-cols-12 pb-2 text-[11px] font-bold uppercase tracking-wider text-[#808080]">
              <div className="col-span-1">#</div>
              <div className="col-span-4">ডিভাইস ও প্ল্যাটফর্ম</div>
              <div className="col-span-3">ডিভাইস আইডি</div>
              <div className="col-span-2">ইনস্টল সময়</div>
              <div className="col-span-2 text-right">সর্বশেষ সক্রিয়</div>
            </div>

            {filteredDevices.map((device, idx) => {
              const isAndroid = device.platform === 'Android';
              const isIos = device.platform === 'iOS';

              return (
                <div
                  key={device.deviceId || idx}
                  className="py-3 flex flex-col sm:grid sm:grid-cols-12 sm:items-center gap-2 hover:bg-black/[0.02] dark:hover:bg-white/[0.02] rounded-lg px-1 transition-colors"
                >
                  <div className="col-span-1 hidden sm:block font-mono text-[11px] text-[#808080]">
                    #{idx + 1}
                  </div>

                  <div className="col-span-4 flex items-center gap-2.5">
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-black/5 dark:bg-white/10 text-base">
                      {isAndroid ? '📱' : isIos ? '🍏' : '💻'}
                    </span>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[13px] font-bold text-[#0f0f0f] dark:text-white">
                          {isAndroid ? 'Android Phone' : isIos ? 'Apple iPhone / iPad' : 'Desktop Browser'}
                        </span>
                        {device.isStandalone && (
                          <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-[9.5px] font-bold text-emerald-600 dark:text-emerald-400">
                            PWA Installed
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-[#808080] sm:hidden">
                        #{idx + 1} • {device.deviceId}
                      </span>
                    </div>
                  </div>

                  <div className="col-span-3 hidden sm:flex items-center gap-1.5">
                    <span className="font-mono text-[11px] text-[#606060] dark:text-white/60 bg-black/5 dark:bg-white/10 px-2 py-0.5 rounded">
                      {device.deviceId?.substring(0, 16)}...
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopy(device.deviceId)}
                      title="আইডি কপি করুন"
                      className="text-[#808080] hover:text-[#0f0f0f] dark:hover:text-white transition-colors p-1"
                    >
                      {copiedId === device.deviceId ? (
                        <CheckCircle2Icon size={13} className="text-emerald-500" />
                      ) : (
                        <CopyIcon size={13} />
                      )}
                    </button>
                  </div>

                  <div className="col-span-2 text-[11.5px] text-[#606060] dark:text-white/60">
                    <span className="sm:hidden text-[#808080] mr-1">ইনস্টল:</span>
                    {device.installedAt ? timeAgo(device.installedAt) : 'পূর্ববর্তী'}
                  </div>

                  <div className="col-span-2 flex items-center justify-between sm:justify-end gap-2 text-[11.5px]">
                    <span className="text-[#808080] sm:hidden">সর্বশেষ সক্রিয়:</span>
                    <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                      {timeAgo(device.lastActiveAt)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
