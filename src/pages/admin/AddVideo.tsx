import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { CopyIcon, ImageIcon, UploadIcon } from 'lucide-react';
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
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!editing) return;
    setThumbnailUrl(editing.thumbnailUrl);
    setTitle(editing.title);
    setEmbedInput(editing.embedUrl);
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

  const handleCopyLink = () => {
    if (!thumbnailUrl) return;
    navigator.clipboard.writeText(thumbnailUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const embedUrl = extractEmbedSrc(embedInput);
    if (!embedUrl) {
      return setError('Please provide a valid video embed URL or iframe.');
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
        title: title.trim() || 'Untitled video',
        sourceName: 'Marketify',
        duration: '',
        status: 'active'
      });

      setSaving(false);

      if (!id) {
        // Reset form so admin can easily publish the next video immediately
        setTitle('');
        setEmbedInput('');
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
        className="max-w-xl space-y-4 rounded-xl bg-white p-4 shadow-sm ring-1 ring-black/5 dark:bg-panel dark:ring-white/5"
      >
        <div>
          <span className="block text-[12px] font-semibold uppercase tracking-wide text-[#606060] dark:text-white/50">
            Thumbnail Image
          </span>
          <div className="mt-2 flex items-center gap-3">
            <div className="grid h-[68px] w-[120px] shrink-0 place-items-center overflow-hidden rounded-md bg-black/5 dark:bg-white/10">
              {thumbnailUrl ? (
                <img src={thumbnailUrl} alt="Thumbnail preview" className="h-full w-full object-cover" />
              ) : (
                <ImageIcon size={20} className="text-[#909090]" />
              )}
            </div>
            <div>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="flex items-center gap-2 rounded-md bg-[#0f0f0f] px-3 py-2 text-[13px] font-medium text-white transition-opacity duration-150 ease-out dark:bg-white dark:text-[#0f0f0f] disabled:opacity-50"
              >
                <UploadIcon size={14} />
                {uploading ? 'Uploading to API...' : 'Upload Image'}
              </button>
              <p className="mt-1.5 text-[12px] text-[#909090] dark:text-white/40">
                Supports JPG, PNG, WEBP, GIF
              </p>
            </div>
          </div>

          {thumbnailUrl && (
            <div className="mt-3 rounded-md bg-black/5 p-2.5 dark:bg-white/5">
              <span className="block text-[11px] font-semibold text-[#606060] dark:text-white/50">
                Generated Image URL:
              </span>
              <div className="mt-1 flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={thumbnailUrl}
                  className="w-full rounded bg-white px-2 py-1 font-mono text-[11px] text-[#0f0f0f] dark:bg-black/40 dark:text-white"
                />
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="flex items-center gap-1 rounded bg-[#0f0f0f] px-2.5 py-1 text-[11px] font-medium text-white dark:bg-white dark:text-[#0f0f0f]"
                >
                  <CopyIcon size={12} />
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
            </div>
          )}

          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
            onChange={onPickFile}
            className="hidden"
          />
        </div>

        <Field label="Video Title">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Enter video title..."
            className="w-full rounded-md bg-black/5 px-3 py-2.5 text-[14px] text-[#0f0f0f] placeholder:text-[#909090] focus:outline-none focus:ring-1 focus:ring-brand dark:bg-white/10 dark:text-white dark:placeholder:text-white/30"
          />
        </Field>

        <Field label="Embed URL or Iframe">
          <textarea
            value={embedInput}
            onChange={(e) => setEmbedInput(e.target.value)}
            rows={3}
            placeholder="Paste YouTube embed URL or iframe snippet..."
            className="w-full rounded-md bg-black/5 px-3 py-2.5 text-[13px] text-[#0f0f0f] placeholder:text-[#909090] focus:outline-none focus:ring-1 focus:ring-brand dark:bg-white/10 dark:text-white dark:placeholder:text-white/30"
          />
          {embedInput && (
            <p className="mt-1 truncate text-[12px] text-[#606060] dark:text-white/40">
              Extracted src: {extractEmbedSrc(embedInput) || 'invalid'}
            </p>
          )}
        </Field>

        {error && (
          <p role="alert" className="text-[13px] text-red-600 dark:text-red-400">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={saving}
          className="w-full rounded-md bg-brand py-2.5 text-[14px] font-bold uppercase tracking-wide text-[#0f0f0f] transition-opacity duration-150 ease-out disabled:opacity-70"
        >
          {saving ? 'Saving...' : id ? 'Update Video' : 'Publish Instantly'}
        </button>
      </form>
    </AdminLayout>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[12px] font-semibold uppercase tracking-wide text-[#606060] dark:text-white/50">
        {label}
      </span>
      <div className="mt-1.5">{children}</div>
    </label>
  );
}
