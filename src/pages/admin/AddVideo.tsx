import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ImageIcon, UploadIcon } from 'lucide-react';
import { AdminLayout } from '../../components/admin/AdminLayout';
import { saveVideo, useVideos } from '../../hooks/useVideos';
import { extractEmbedSrc } from '../../utils/embed';
import { uploadThumbnail } from '../../utils/uploadImage';

export function AddVideo() {
  const { id } = useParams<{ id: string }>();
  const { videos } = useVideos();
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);

  const editing = useMemo(() => videos.find((v) => v.id === id), [videos, id]);

  const [thumbnailUrl, setThumbnailUrl] = useState('');
  const [title, setTitle] = useState('');
  const [embedInput, setEmbedInput] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!editing) return;
    setThumbnailUrl(editing.thumbnailUrl);
    setTitle(editing.title);
    setEmbedInput(editing.embedUrl);
    setWebsiteUrl(editing.websiteUrl || '');
  }, [editing]);

  const onPickFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    setUploading(true);
    try {
      const url = await uploadThumbnail(file);
      setThumbnailUrl(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed.');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const embedUrl = extractEmbedSrc(embedInput);
    const cleanWebsite = websiteUrl.trim();

    if (!embedUrl && !cleanWebsite) {
      return setError('দয়া করে ইম্বেড লিংক অথবা ওয়েবসাইট লিংক দিন।');
    }

    const finalThumbnail =
      thumbnailUrl.trim() ||
      'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&auto=format&fit=crop&q=60';

    setSaving(true);
    try {
      const targetId = id ?? null;
      await saveVideo(targetId, {
        thumbnailUrl: finalThumbnail,
        embedUrl,
        websiteUrl: cleanWebsite,
        title: title.trim() || 'Untitled post',
        sourceName: 'Marketify',
        duration: '',
        status: 'active'
      });

      setSaving(false);

      if (!id) {
        setTitle('');
        setEmbedInput('');
        setWebsiteUrl('');
        setThumbnailUrl('');
        if (fileRef.current) fileRef.current.value = '';
      }

      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setSaving(false);
      setError(err instanceof Error ? err.message : 'Save failed.');
    }
  };

  return (
    <AdminLayout title={id ? 'Edit Video' : 'Add New Video'}>
      <form
        onSubmit={onSubmit}
        className="max-w-md space-y-3 rounded-xl bg-white p-3.5 shadow-sm ring-1 ring-black/5 dark:bg-panel dark:ring-white/5"
      >
        <div>
          <span className="block text-[11px] font-semibold text-[#505050] dark:text-white/60 mb-1">
            Thumbnail
          </span>
          <div className="flex items-center gap-2.5">
            <div className="grid h-12 w-20 shrink-0 place-items-center overflow-hidden rounded-md bg-black/5 dark:bg-white/10">
              {thumbnailUrl ? (
                <img src={thumbnailUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <ImageIcon size={18} className="text-[#909090]" />
              )}
            </div>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="flex items-center gap-1.5 rounded-md bg-[#0f0f0f] px-3 py-1.5 text-[12px] font-medium text-white transition-opacity duration-150 ease-out dark:bg-white dark:text-[#0f0f0f] disabled:opacity-50"
            >
              <UploadIcon size={13} />
              {uploading ? 'Uploading...' : 'Upload Image'}
            </button>
          </div>

          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
            onChange={onPickFile}
            className="hidden"
          />
        </div>

        <Field label="Title">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title"
            className="h-9 w-full rounded-md bg-black/5 px-2.5 text-[13px] text-[#0f0f0f] placeholder:text-[#909090] focus:outline-none focus:ring-1 focus:ring-brand dark:bg-white/10 dark:text-white dark:placeholder:text-white/30"
          />
        </Field>

        <Field label="Embed Link">
          <textarea
            value={embedInput}
            onChange={(e) => setEmbedInput(e.target.value)}
            rows={2}
            placeholder="Embed URL or iframe..."
            className="w-full rounded-md bg-black/5 px-2.5 py-1.5 text-[12px] text-[#0f0f0f] placeholder:text-[#909090] focus:outline-none focus:ring-1 focus:ring-brand dark:bg-white/10 dark:text-white dark:placeholder:text-white/30 resize-none"
          />
        </Field>

        <Field label="Website Link">
          <input
            type="url"
            value={websiteUrl}
            onChange={(e) => setWebsiteUrl(e.target.value)}
            placeholder="https://..."
            className="h-9 w-full rounded-md bg-black/5 px-2.5 text-[13px] text-[#0f0f0f] placeholder:text-[#909090] focus:outline-none focus:ring-1 focus:ring-brand dark:bg-white/10 dark:text-white dark:placeholder:text-white/30"
          />
        </Field>

        {error && (
          <p role="alert" className="text-[12px] text-red-600 dark:text-red-400">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={saving}
          className="h-9 w-full rounded-md bg-brand text-[13px] font-semibold text-[#0f0f0f] transition-opacity duration-150 ease-out disabled:opacity-70"
        >
          {saving ? 'Saving...' : id ? 'Update Video' : 'Publish'}
        </button>
      </form>
    </AdminLayout>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[11px] font-semibold text-[#505050] dark:text-white/60 mb-1">
        {label}
      </span>
      <div>{children}</div>
    </label>
  );
}
