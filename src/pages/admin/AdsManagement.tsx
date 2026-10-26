import React, { useEffect, useState } from 'react';
import { PlusIcon, ShieldAlertIcon, Trash2Icon } from 'lucide-react';
import { AdminLayout } from '../../components/admin/AdminLayout';
import { removeAd, saveAd, useAds } from '../../hooks/useAds';
import type { Ad, AdType } from '../../types';

export function AdsManagement() {
  const { ads } = useAds();
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  useEffect(() => {
    setDrafts((prev) => {
      const next = { ...prev };
      ads.forEach((ad) => {
        if (next[ad.id] === undefined) next[ad.id] = ad.script;
      });
      return next;
    });
  }, [ads]);

  const notify = (text: string) => {
    setMessage(text);
    window.setTimeout(() => setMessage(''), 2500);
  };

  const [localAdsState, setLocalAdsState] = useState<Ad[]>([]);

  useEffect(() => {
    setLocalAdsState(ads);
  }, [ads]);

  const persist = async (ad: Ad, patch: Partial<Ad>) => {
    const updated = { ...ad, ...patch, updatedAt: Date.now() };
    // Instant optimistic update
    setLocalAdsState((prev) => prev.map((a) => (a.id === ad.id ? updated : a)));
    setSavingId(ad.id);
    try {
      await saveAd(updated);
      notify(`"${ad.name}" ${patch.status ? (patch.status === 'on' ? 'turned ON' : 'turned OFF') : 'saved'} successfully!`);
    } catch {
      notify('Failed to save ad.');
    } finally {
      setSavingId(null);
    }
  };

  const addAdUnit = async (type: AdType, name: string) => {
    const id = `ad_${type}_${Date.now()}`;
    const newAd: Ad = {
      id,
      name,
      type,
      script: '<script>/* Ad script here */</script>',
      status: 'off',
      placement: 'Public Frontend',
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    await saveAd(newAd);
    notify(`New ad unit "${name}" added!`);
  };

  const onDelete = async (id: string, name: string) => {
    if (!window.confirm(`Delete ad unit "${name}"?`)) return;
    await removeAd(id);
    notify(`Ad unit deleted.`);
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
              As requested, advertisements are <strong>strictly disabled</strong> across all admin pages. Ads only run on the public user frontend according to your ON/OFF settings below.
            </p>
          </div>
        </div>
      </div>

      {message && (
        <p role="status" className="mb-4 rounded-lg bg-green-50 px-4 py-3 text-[13px] font-semibold text-green-700 dark:bg-green-950 dark:text-green-300">
          {message}
        </p>
      )}

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
                  Type: {ad.type} • Placement: {ad.placement}
                </p>
              </div>
              <div className="flex items-center gap-2">
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
                Ad Script / HTML / JS
              </span>
              <textarea
                value={drafts[ad.id] ?? ''}
                onChange={(e) => setDrafts((d) => ({ ...d, [ad.id]: e.target.value }))}
                rows={4}
                spellCheck={false}
                className="mt-1.5 w-full rounded-md bg-black/5 p-3 font-mono text-[12px] leading-5 text-[#0f0f0f] focus:outline-none focus:ring-1 focus:ring-brand dark:bg-white/10 dark:text-white"
              />
            </label>

            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => persist(ad, { script: drafts[ad.id] ?? ad.script })}
                disabled={savingId === ad.id}
                className="rounded-md bg-brand px-4 py-2 text-[13px] font-bold text-[#0f0f0f] transition-opacity duration-150 ease-out disabled:opacity-60"
              >
                {savingId === ad.id ? 'Saving...' : 'Save Script'}
              </button>
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
          onClick={() => addAdUnit('banner_468x60', `Banner Ad #${ads.filter(a => a.type === 'banner_468x60').length + 1}`)}
          className="flex items-center gap-2 rounded-md bg-[#0f0f0f] px-4 py-2.5 text-[13px] font-semibold text-white dark:bg-white dark:text-[#0f0f0f]"
        >
          <PlusIcon size={15} />
          Add Banner Ad
        </button>
        <button
          type="button"
          onClick={() => addAdUnit('social_bar', `Social Bar Ad #${ads.filter(a => a.type === 'social_bar').length + 1}`)}
          className="flex items-center gap-2 rounded-md bg-[#0f0f0f] px-4 py-2.5 text-[13px] font-semibold text-white dark:bg-white dark:text-[#0f0f0f]"
        >
          <PlusIcon size={15} />
          Add Social Bar / Popunder
        </button>
      </div>
    </AdminLayout>
  );
}
