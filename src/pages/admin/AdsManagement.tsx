import React, { useEffect, useState } from 'react';
import { CheckCircle2Icon, DownloadIcon, PlusIcon, ShieldAlertIcon, Trash2Icon } from 'lucide-react';
import { AdminLayout } from '../../components/admin/AdminLayout';
import { removeAd, saveAd, useAds } from '../../hooks/useAds';
import { setDownloadDirectLink, useDownloadDirectLink } from '../../utils/downloadLink';
import type { Ad, AdType } from '../../types';

const PLACEHOLDER_SCRIPT = '<script>/* Ad script here */</script>';

const AD_TYPE_LABELS: Record<AdType, string> = {
  banner_468x60: 'Banner Ad (468x60 / 300x250 / 728x90 / Image)',
  in_feed: 'In-Feed / Native Banner',
  social_bar: 'Social Bar / Popunder / Push / MultiTag / Direct Link'
};

function getPlacementForType(type: AdType): string {
  if (type === 'social_bar') return 'Public Frontend';
  if (type === 'in_feed') return 'Public Feed & Video Page';
  return 'Public Feed & Video Page';
}

export function AdsManagement() {
  const { ads } = useAds();
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  // Quick composer state for adding any new ad and activating it immediately
  const [newType, setNewType] = useState<AdType>('banner_468x60');
  const [newName, setNewName] = useState('');
  const [newScript, setNewScript] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    setDrafts((prev) => {
      const next = { ...prev };
      ads.forEach((ad) => {
        if (next[ad.id] === undefined) next[ad.id] = ad.script;
      });
      return next;
    });
  }, [ads]);

  const { downloadLink } = useDownloadDirectLink();
  const [downloadUrlInput, setDownloadUrlInput] = useState(downloadLink);
  const [downloadMsg, setDownloadMsg] = useState('');
  const [savingDownload, setSavingDownload] = useState(false);

  useEffect(() => {
    setDownloadUrlInput(downloadLink);
  }, [downloadLink]);

  const handleSaveDownloadLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingDownload(true);
    setDownloadMsg('');
    try {
      await setDownloadDirectLink(downloadUrlInput);
      setDownloadMsg('✓ ডাউনলোড ডিরেক্ট লিংক সফলভাবে সংরক্ষিত হয়েছে!');
      window.setTimeout(() => setDownloadMsg(''), 3000);
    } catch {
      setDownloadMsg('❌ ডিরেক্ট লিংক সংরক্ষণ ব্যর্থ হয়েছে');
    } finally {
      setSavingDownload(false);
    }
  };

  const notify = (text: string) => {
    setMessage(text);
    window.setTimeout(() => setMessage(''), 3500);
  };

  const [localAdsState, setLocalAdsState] = useState<Ad[]>([]);

  useEffect(() => {
    setLocalAdsState(ads);
  }, [ads]);

  const persist = async (ad: Ad, patch: Partial<Ad>) => {
    const nextScript = patch.script !== undefined ? patch.script : ad.script;
    const isReplacingPlaceholder =
      ad.script.trim() === PLACEHOLDER_SCRIPT &&
      nextScript.trim().length > 0 &&
      nextScript.trim() !== PLACEHOLDER_SCRIPT;

    // Auto-activate when admin replaces default placeholder with a real ad code
    const resolvedStatus =
      patch.status !== undefined
        ? patch.status
        : isReplacingPlaceholder && ad.status === 'off'
          ? 'on'
          : ad.status;

    const updated: Ad = {
      ...ad,
      ...patch,
      status: resolvedStatus,
      placement: patch.type ? getPlacementForType(patch.type) : ad.placement,
      updatedAt: Date.now()
    };

    setLocalAdsState((prev) => prev.map((a) => (a.id === ad.id ? updated : a)));
    setSavingId(ad.id);
    try {
      await saveAd(updated);
      if (patch.status) {
        notify(`✓ "${updated.name}" ${updated.status === 'on' ? 'চালু (ON) করা হয়েছে' : 'বন্ধ (OFF) করা হয়েছে'}!`);
      } else if (isReplacingPlaceholder && updated.status === 'on') {
        notify(`✓ "${updated.name}" সেভ এবং সাথে সাথে চালু (ON) করা হয়েছে!`);
      } else {
        notify(`✓ "${updated.name}" সফলভাবে সেভ এবং সিঙ্ক হয়েছে!`);
      }
    } catch {
      notify('❌ অ্যাড সংরক্ষণ করতে সমস্যা হয়েছে।');
    } finally {
      setSavingId(null);
    }
  };

  const handleCreateNewAd = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanScript = newScript.trim();
    if (!cleanScript) {
      notify('❌ অনুগ্রহ করে অ্যাডের কোড / স্ক্রিপ্ট / লিংক বসান।');
      return;
    }

    const prefixLabel =
      newType === 'social_bar'
        ? 'Social Bar Ad'
        : newType === 'in_feed'
          ? 'Native / In-Feed Ad'
          : 'Banner Ad';
    const countOfType = ads.filter((a) => a.type === newType).length + 1;
    const resolvedName = newName.trim() || `${prefixLabel} #${countOfType}`;
    const id = `ad_${newType}_${Date.now()}`;
    const now = Date.now();

    const newAd: Ad = {
      id,
      name: resolvedName,
      type: newType,
      script: cleanScript,
      status: 'on',
      placement: getPlacementForType(newType),
      createdAt: now,
      updatedAt: now
    };

    setCreating(true);
    try {
      setDrafts((d) => ({ ...d, [id]: cleanScript }));
      await saveAd(newAd);
      setNewName('');
      setNewScript('');
      notify(`✓ "${resolvedName}" যুক্ত এবং সাথে সাথে চালু (ON) করা হয়েছে!`);
    } catch {
      notify('❌ নতুন অ্যাড যোগ করা যায়নি।');
    } finally {
      setCreating(false);
    }
  };

  const addAdUnit = async (type: AdType, name: string) => {
    const id = `ad_${type}_${Date.now()}`;
    const now = Date.now();
    const newAd: Ad = {
      id,
      name,
      type,
      script: PLACEHOLDER_SCRIPT,
      status: 'off',
      placement: getPlacementForType(type),
      createdAt: now,
      updatedAt: now
    };
    setDrafts((d) => ({ ...d, [id]: PLACEHOLDER_SCRIPT }));
    await saveAd(newAd);
    notify(`✓ নতুন ইউনিট "${name}" যোগ হয়েছে — নিচে কোড বসিয়ে Save করুন।`);
  };

  const onDelete = async (id: string, name: string) => {
    if (!window.confirm(`Delete ad unit "${name}"?`)) return;
    await removeAd(id);
    notify(`✓ "${name}" মুছে ফেলা হয়েছে।`);
  };

  return (
    <AdminLayout title="Ads Management & Toggle">
      {/* Zero Ads Guarantee Notice Box */}
      <div className="mb-5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 p-4 text-emerald-800 dark:text-emerald-300">
        <div className="flex items-start gap-3">
          <ShieldAlertIcon size={22} className="shrink-0 text-emerald-600 dark:text-emerald-400 mt-0.5" />
          <div>
            <h2 className="text-[15px] font-bold">100% Admin Panel Ad Protection</h2>
            <p className="mt-1 text-[13px] opacity-90">
              As requested, advertisements are <strong>strictly disabled</strong> across all admin pages. Ads run across all public user pages immediately according to your ON/OFF settings below.
            </p>
          </div>
        </div>
      </div>

      {/* Live Feedback Banner */}
      {message && (
        <div className="mb-5 flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-[13px] font-semibold text-white shadow-md">
          <CheckCircle2Icon size={18} className="shrink-0" />
          <span>{message}</span>
        </div>
      )}

      {/* Quick Add & Activate Any Ad Type */}
      <section className="mb-6 rounded-xl bg-white p-5 shadow-sm ring-1 ring-black/5 dark:bg-panel dark:ring-white/5 border-l-4 border-brand">
        <div className="flex items-center gap-2">
          <PlusIcon className="h-5 w-5 text-brand" />
          <h2 className="text-[16px] font-semibold text-[#0f0f0f] dark:text-white">
            নতুন অ্যাড যুক্ত করুন (যেকোনো ধরনের অ্যাড — সাথে সাথে কাজ করবে)
          </h2>
        </div>
        <p className="mt-1 text-[12px] text-[#606060] dark:text-white/50">
          Banner (468x60, 300x250, 728x90), Native/In-Feed, Social Bar, Popunder, In-Page Push, MultiTag, HTML/Image অথবা Direct JS/Link — যেকোনো কোড এখানে দিয়ে Add করলেই সাথে সাথে ইউজার প্যানেলে চালু হয়ে যাবে।
        </p>

        <form onSubmit={handleCreateNewAd} className="mt-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block">
              <span className="block text-[11px] font-semibold uppercase tracking-wide text-[#606060] dark:text-white/50">
                Ad Type (অ্যাডের ধরন)
              </span>
              <select
                value={newType}
                onChange={(e) => setNewType(e.target.value as AdType)}
                className="mt-1 w-full rounded-md bg-black/5 px-3 py-2 text-[13px] font-medium text-[#0f0f0f] focus:outline-none focus:ring-1 focus:ring-brand dark:bg-white/10 dark:text-white"
              >
                <option value="banner_468x60" className="dark:bg-[#1a1a1a]">
                  Banner Ad (468x60 / 300x250 / 728x90 / Image)
                </option>
                <option value="in_feed" className="dark:bg-[#1a1a1a]">
                  In-Feed / Native Banner
                </option>
                <option value="social_bar" className="dark:bg-[#1a1a1a]">
                  Social Bar / Popunder / Push / MultiTag / Direct Link
                </option>
              </select>
            </label>

            <label className="block">
              <span className="block text-[11px] font-semibold uppercase tracking-wide text-[#606060] dark:text-white/50">
                Ad Name (ঐচ্ছিক)
              </span>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="যেমন: Monetag Popunder বা 300x250 Banner"
                className="mt-1 w-full rounded-md bg-black/5 px-3 py-2 text-[13px] text-[#0f0f0f] focus:outline-none focus:ring-1 focus:ring-brand dark:bg-white/10 dark:text-white"
              />
            </label>
          </div>

          <label className="block">
            <span className="block text-[11px] font-semibold uppercase tracking-wide text-[#606060] dark:text-white/50">
              Ad Script / HTML / JS / Direct URL
            </span>
            <textarea
              value={newScript}
              onChange={(e) => setNewScript(e.target.value)}
              rows={3}
              spellCheck={false}
              placeholder={'<script src="..." data-zone="..."></script> অথবা https://...'}
              className="mt-1 w-full rounded-md bg-black/5 p-3 font-mono text-[12px] leading-5 text-[#0f0f0f] focus:outline-none focus:ring-1 focus:ring-brand dark:bg-white/10 dark:text-white"
            />
          </label>

          <button
            type="submit"
            disabled={creating}
            className="inline-flex items-center gap-2 rounded-md bg-brand px-4 py-2 text-[13px] font-bold text-[#0f0f0f] transition-all active:scale-95 disabled:opacity-50"
          >
            <PlusIcon size={15} />
            {creating ? 'যুক্ত হচ্ছে...' : 'অ্যাড যুক্ত ও চালু করুন (Add & Turn ON)'}
          </button>
        </form>
      </section>

      {/* Video Download Direct Link Management */}
      <section className="mb-6 rounded-xl bg-white p-5 shadow-sm ring-1 ring-black/5 dark:bg-panel dark:ring-white/5 border-l-4 border-emerald-500">
        <div className="flex items-center gap-2">
          <DownloadIcon className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          <h2 className="text-[16px] font-semibold text-[#0f0f0f] dark:text-white">
            ভিডিও ডাউনলোড ডিরেক্ট লিংক (Download Direct Link / Ad Link)
          </h2>
        </div>
        <p className="mt-1 text-[12px] text-[#606060] dark:text-white/50">
          প্রতিটি ভিডিওর নিচের ৪ নম্বর বাটন 'Download'-এ ক্লিক করলে ইউজারকে এই ডিরেক্ট লিংকে নিয়ে যাওয়া হবে। এটি ফায়ারবেস থেকে রিয়েলটাইমে সব ভিডিওতে একসাথে আপডেট হয়।
        </p>
        <form onSubmit={handleSaveDownloadLink} className="mt-3 space-y-3">
          <label className="block">
            <span className="block text-[12px] font-semibold uppercase tracking-wide text-[#606060] dark:text-white/50">
              Direct Download / Monetization URL
            </span>
            <input
              type="text"
              value={downloadUrlInput}
              onChange={(e) => setDownloadUrlInput(e.target.value)}
              placeholder="https://ads-network.markafi189.workers.dev/"
              className="mt-1.5 w-full rounded-md bg-black/5 px-3 py-2.5 font-mono text-[13px] text-[#0f0f0f] focus:outline-none focus:ring-1 focus:ring-brand dark:bg-white/10 dark:text-white"
            />
          </label>
          {downloadMsg && <p className="text-[13px] font-medium text-emerald-600 dark:text-emerald-400">{downloadMsg}</p>}
          <button
            type="submit"
            disabled={savingDownload}
            className="rounded-md bg-emerald-600 px-4 py-2 text-[13px] font-bold text-white hover:bg-emerald-700 disabled:opacity-50 transition-all active:scale-95 shadow-sm"
          >
            {savingDownload ? 'সংরক্ষণ হচ্ছে...' : 'ডিরেক্ট লিংক সেভ করুন'}
          </button>
        </form>
      </section>

      <div className="space-y-4">
        {localAdsState.map((ad) => (
          <section
            key={ad.id}
            className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-black/5 dark:bg-panel dark:ring-white/5"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-[16px] font-semibold text-[#0f0f0f] dark:text-white">
                  {ad.name}
                </h2>
                <p className="text-[12px] text-[#909090] dark:text-white/50">
                  {AD_TYPE_LABELS[ad.type] || ad.type} • {ad.placement}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <select
                  aria-label="Ad type"
                  value={ad.type}
                  onChange={(e) => persist(ad, { type: e.target.value as AdType })}
                  disabled={savingId === ad.id}
                  className="rounded-md bg-black/5 px-2.5 py-1.5 text-[12px] font-medium text-[#0f0f0f] dark:bg-white/10 dark:text-white"
                >
                  <option value="banner_468x60" className="dark:bg-[#1a1a1a]">Banner</option>
                  <option value="in_feed" className="dark:bg-[#1a1a1a]">In-Feed / Native</option>
                  <option value="social_bar" className="dark:bg-[#1a1a1a]">Social Bar / Popunder / Global</option>
                </select>
                {/* ON / OFF Toggle Button */}
                <button
                  type="button"
                  onClick={() => persist(ad, { status: ad.status === 'on' ? 'off' : 'on' })}
                  disabled={savingId === ad.id}
                  aria-pressed={ad.status === 'on'}
                  className={`rounded-full px-4 py-2 text-[13px] font-bold uppercase tracking-wide transition-colors duration-150 ease-out disabled:opacity-60 ${
                    ad.status === 'on'
                      ? 'bg-green-600 text-white shadow-md shadow-green-600/20'
                      : 'bg-neutral-200 text-neutral-700 dark:bg-white/10 dark:text-white/60'
                  }`}
                >
                  {ad.status === 'on' ? 'ON' : 'OFF'}
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(ad.id, ad.name)}
                  aria-label="Delete ad"
                  className="grid h-9 w-9 place-items-center rounded-md text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
                >
                  <Trash2Icon size={16} />
                </button>
              </div>
            </div>

            <label className="mt-4 block">
              <span className="block text-[12px] font-semibold uppercase tracking-wide text-[#606060] dark:text-white/50">
                Ad Script / HTML / JS / Direct URL
              </span>
              <textarea
                value={drafts[ad.id] ?? ''}
                onChange={(e) => setDrafts((d) => ({ ...d, [ad.id]: e.target.value }))}
                rows={4}
                spellCheck={false}
                className="mt-1.5 w-full rounded-md bg-black/5 p-3 font-mono text-[12px] leading-5 text-[#0f0f0f] focus:outline-none focus:ring-1 focus:ring-brand dark:bg-white/10 dark:text-white"
              />
            </label>

            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => persist(ad, { script: drafts[ad.id] ?? ad.script })}
                disabled={savingId === ad.id}
                className="rounded-md bg-brand px-4 py-2 text-[13px] font-bold text-[#0f0f0f] transition-opacity duration-150 ease-out disabled:opacity-60"
              >
                {savingId === ad.id ? 'Saving...' : 'Save Script'}
              </button>
              {ad.status === 'off' && (
                <button
                  type="button"
                  onClick={() => persist(ad, { script: drafts[ad.id] ?? ad.script, status: 'on' })}
                  disabled={savingId === ad.id}
                  className="rounded-md bg-emerald-600 px-4 py-2 text-[13px] font-bold text-white transition-opacity duration-150 ease-out disabled:opacity-60"
                >
                  Save & Turn ON
                </button>
              )}
              <button
                type="button"
                onClick={() => setDrafts((d) => ({ ...d, [ad.id]: ad.script }))}
                className="rounded-md bg-black/5 px-4 py-2 text-[13px] font-medium text-[#404040] dark:bg-white/10 dark:text-white/70"
              >
                Reset
              </button>
            </div>
          </section>
        ))}
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => addAdUnit('banner_468x60', `Banner Ad #${ads.filter((a) => a.type === 'banner_468x60').length + 1}`)}
          className="flex items-center gap-2 rounded-md bg-[#0f0f0f] px-4 py-2.5 text-[13px] font-semibold text-white dark:bg-white dark:text-[#0f0f0f]"
        >
          <PlusIcon size={15} />
          Add Banner Ad
        </button>
        <button
          type="button"
          onClick={() => addAdUnit('in_feed', `Native / In-Feed Ad #${ads.filter((a) => a.type === 'in_feed').length + 1}`)}
          className="flex items-center gap-2 rounded-md bg-[#0f0f0f] px-4 py-2.5 text-[13px] font-semibold text-white dark:bg-white dark:text-[#0f0f0f]"
        >
          <PlusIcon size={15} />
          Add In-Feed / Native Banner
        </button>
        <button
          type="button"
          onClick={() => addAdUnit('social_bar', `Social Bar Ad #${ads.filter((a) => a.type === 'social_bar').length + 1}`)}
          className="flex items-center gap-2 rounded-md bg-[#0f0f0f] px-4 py-2.5 text-[13px] font-semibold text-white dark:bg-white dark:text-[#0f0f0f]"
        >
          <PlusIcon size={15} />
          Add Social Bar / Popunder
        </button>
      </div>
    </AdminLayout>
  );
}
