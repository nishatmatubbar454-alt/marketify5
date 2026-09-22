import React, { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  BookmarkIcon,
  ClockIcon,
  FlameIcon,
  HandshakeIcon,
  HomeIcon,
  LockIcon,
  MenuIcon,
  MoonIcon,
  PhoneCallIcon,
  PlayIcon,
  SearchIcon,
  SendIcon,
  SunIcon,
  TrendingUpIcon,
  XIcon
} from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useVideos } from '../hooks/useVideos';
import { formatViews, timeAgo } from '../utils/format';
import { getContactLink, getTelegramLink } from '../utils/helpers';
import type { Video } from '../types';

export function Header() {
  const { theme, toggleTheme } = useTheme();
  const { videos } = useVideos();
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchParams] = useSearchParams();
  const [term, setTerm] = useState(searchParams.get('q') || '');
  const navigate = useNavigate();

  // Instant live filtered video search results
  const liveResults = useMemo(() => {
    const active = videos.filter((v) => v.status === 'active');
    const q = term.trim().toLowerCase();
    if (!q) {
      // If search input is empty, provide top 6 latest/trending videos as suggestions
      return active.slice(0, 6);
    }

    const words = q.split(/\s+/).filter(Boolean);
    return active
      .filter((v) => {
        const title = (v.title || '').toLowerCase();
        const source = (v.sourceName || '').toLowerCase();
        // Check if full query or all words match
        if (title.includes(q) || source.includes(q)) return true;
        return words.every((w) => title.includes(w) || source.includes(w));
      })
      .sort((a, b) => {
        const aTitle = (a.title || '').toLowerCase();
        const bTitle = (b.title || '').toLowerCase();
        // Prioritize exact or start match
        if (aTitle.startsWith(q) && !bTitle.startsWith(q)) return -1;
        if (!aTitle.startsWith(q) && bTitle.startsWith(q)) return 1;
        return (b.createdAt || 0) - (a.createdAt || 0);
      });
  }, [videos, term]);

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const query = term.trim();
    if (query) {
      navigate(`/?q=${encodeURIComponent(query)}`);
    } else {
      navigate('/');
    }
    setSearchOpen(false);
  };

  const handleSelectVideo = (videoId: string) => {
    setSearchOpen(false);
    const targetVideo = videos.find((v) => v.id === videoId);
    navigate(`/video/${videoId}`, { state: { video: targetVideo } });
  };

  const handleClearSearch = () => {
    setTerm('');
  };

  return (
    <>
      <header className="sticky top-0 z-40 bg-[#0f0f0f] border-b border-white/10">
        <div className="mx-auto flex h-14 w-full max-w-[1100px] items-center gap-2 px-3">
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
            className="grid h-10 w-10 place-items-center rounded-full text-white transition-all duration-100 ease-out hover:bg-white/10 active:scale-90"
          >
            {menuOpen ? <XIcon size={24} /> : <MenuIcon size={24} />}
          </button>

          <Link to="/" className="flex flex-1 items-center gap-1.5 active:scale-[0.98] transition-transform" aria-label="Marketify home">
            <span className="grid h-7 w-7 place-items-center rounded-full bg-brand text-[#0f0f0f]">
              <HandshakeIcon size={17} strokeWidth={2.5} />
            </span>
            <span className="text-[20px] font-bold leading-none tracking-tight text-brand">
              Marketify
            </span>
          </Link>

          <button
            type="button"
            onClick={toggleTheme}
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
            className="flex h-7 w-[54px] items-center rounded-full bg-[#2a2a2a] px-1 active:scale-95 transition-transform"
          >
            <span
              className={`grid h-5 w-5 place-items-center rounded-full text-[#0f0f0f] transition-transform duration-200 ease-out ${
                theme === 'dark' ? 'translate-x-[26px] bg-white' : 'translate-x-0 bg-white'
              }`}
            >
              {theme === 'dark' ? <MoonIcon size={12} /> : <SunIcon size={12} />}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setSearchOpen(true);
              setTerm(searchParams.get('q') || '');
            }}
            aria-label="Search videos"
            className="grid h-10 w-10 place-items-center rounded-full text-white transition-all duration-100 ease-out hover:bg-white/10 active:scale-90"
          >
            <SearchIcon size={22} />
          </button>
        </div>
      </header>

      {/* Live Search Modal Overlay */}
      {searchOpen && (
        <div className="fixed inset-0 z-50 bg-[#0f0f0f] flex flex-col animate-in fade-in duration-150">
          {/* Top Search Input Bar */}
          <div className="mx-auto flex h-14 w-full max-w-[1100px] items-center gap-2 px-3 border-b border-white/10">
            <form onSubmit={submitSearch} className="relative flex flex-1 items-center rounded-full bg-[#222] px-3.5 py-1.5 focus-within:ring-2 focus-within:ring-brand">
              <SearchIcon size={18} className="text-white/60 shrink-0 mr-2" />
              <input
                autoFocus
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                placeholder="ভিডিওর নাম লিখে সার্চ করুন / Search videos..."
                className="w-full bg-transparent text-sm text-white placeholder:text-white/40 focus:outline-none"
              />
              {term && (
                <button
                  type="button"
                  onClick={handleClearSearch}
                  aria-label="Clear search"
                  className="grid h-6 w-6 place-items-center rounded-full text-white/60 hover:text-white hover:bg-white/10"
                >
                  <XIcon size={14} />
                </button>
              )}
            </form>
            <button
              type="button"
              onClick={() => setSearchOpen(false)}
              className="text-sm font-medium text-white/80 hover:text-white px-2.5 py-1.5 rounded-lg hover:bg-white/10 transition-colors"
            >
              বাতিল
            </button>
          </div>

          {/* Search Content & Live Results */}
          <div className="flex-1 overflow-y-auto p-3 max-w-[1100px] mx-auto w-full">
            {term.trim() ? (
              <div className="mb-3 flex items-center justify-between">
                <span className="text-xs font-medium text-white/70">
                  {liveResults.length > 0
                    ? `"${term}" এর জন্য পাওয়া ফলাফল (${liveResults.length})`
                    : `"${term}" দিয়ে কোনো ভিডিও পাওয়া যায়নি`}
                </span>
                {liveResults.length > 0 && (
                  <button
                    type="button"
                    onClick={submitSearch}
                    className="text-xs font-semibold text-brand hover:underline"
                  >
                    ফিডে সব দেখুন &rarr;
                  </button>
                )}
              </div>
            ) : (
              <div className="mb-3 flex items-center gap-1.5 text-xs font-medium text-white/50">
                <TrendingUpIcon size={14} className="text-brand" />
                <span>সাম্প্রতিক ও জনপ্রিয় ভিডিওসমূহ:</span>
              </div>
            )}

            {/* List of Video Suggestions / Live Results */}
            {liveResults.length > 0 ? (
              <div className="grid gap-2 sm:grid-cols-2">
                {liveResults.map((v: Video) => (
                  <div
                    key={v.id}
                    onClick={() => handleSelectVideo(v.id)}
                    className="flex cursor-pointer items-center gap-3 rounded-xl bg-[#1a1a1a] p-2 hover:bg-[#252525] transition-colors border border-white/5 group"
                  >
                    {/* Thumbnail */}
                    <div className="relative h-16 w-28 shrink-0 overflow-hidden rounded-lg bg-neutral-800">
                      {v.thumbnailUrl ? (
                        <img
                          src={v.thumbnailUrl}
                          alt=""
                          className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-200"
                        />
                      ) : (
                        <div className="grid h-full w-full place-items-center bg-neutral-900 text-white/40">
                          <PlayIcon size={18} />
                        </div>
                      )}
                      <span className="absolute inset-0 grid place-items-center bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity">
                        <PlayIcon size={16} fill="white" className="text-white drop-shadow" />
                      </span>
                      {v.duration && (
                        <span className="absolute bottom-1 right-1 rounded bg-black/80 px-1 py-0.2 text-[9px] font-medium text-white">
                          {v.duration}
                        </span>
                      )}
                    </div>

                    {/* Meta */}
                    <div className="min-w-0 flex-1">
                      <h4 className="line-clamp-2 text-[13px] font-medium text-white group-hover:text-brand leading-snug">
                        {v.title}
                      </h4>
                      <p className="mt-1 text-[11px] text-white/50 truncate">
                        {v.sourceName ? `${v.sourceName} • ` : ''}
                        {formatViews(v.views)} • {timeAgo(v.createdAt)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-12 text-center">
                <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-white/5 text-white/40 mb-3">
                  <SearchIcon size={24} />
                </div>
                <p className="text-sm font-medium text-white/80">কোনো ফলাফল পাওয়া যায়নি</p>
                <p className="text-xs text-white/40 mt-1">অন্য কোনো কি-ওয়ার্ড দিয়ে আবার চেষ্টা করুন</p>
                <button
                  type="button"
                  onClick={handleClearSearch}
                  className="mt-4 inline-block rounded-lg bg-brand px-4 py-2 text-xs font-semibold text-[#0f0f0f]"
                >
                  সার্চ ক্লিয়ার করুন
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Slide-out Menu */}
      {menuOpen && (
        <div className="fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/60" onClick={() => setMenuOpen(false)} />
          <aside className="relative flex w-[280px] flex-col bg-[#121212] text-white shadow-2xl">
            <div className="flex h-14 items-center gap-2 px-4 border-b border-white/10">
              <span className="grid h-7 w-7 place-items-center rounded-full bg-brand text-[#0f0f0f]">
                <HandshakeIcon size={17} strokeWidth={2.5} />
              </span>
              <span className="text-[18px] font-bold text-brand flex-1">Marketify</span>
              <button
                type="button"
                onClick={() => setMenuOpen(false)}
                aria-label="Close menu"
                className="grid h-8 w-8 place-items-center rounded-full text-white/70 hover:bg-white/10 hover:text-white"
              >
                <XIcon size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-3 px-2 space-y-1">
              <Link
                to="/"
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-4 rounded-lg px-3 py-3 text-[15px] font-medium text-white hover:bg-white/10"
              >
                <HomeIcon size={20} className="text-brand" />
                Home
              </Link>
              <Link
                to="/trending"
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-4 rounded-lg px-3 py-3 text-[15px] font-medium text-white/90 hover:bg-white/10 hover:text-white"
              >
                <FlameIcon size={20} className="text-orange-500" />
                Trending
              </Link>
              <Link
                to="/history"
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-4 rounded-lg px-3 py-3 text-[15px] font-medium text-white/90 hover:bg-white/10 hover:text-white"
              >
                <ClockIcon size={20} className="text-blue-400" />
                History
              </Link>
              <Link
                to="/favorites"
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-4 rounded-lg px-3 py-3 text-[15px] font-medium text-white/90 hover:bg-white/10 hover:text-white"
              >
                <BookmarkIcon size={20} className="text-red-400" />
                Favorite
              </Link>
              <Link
                to="/erfan"
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-4 rounded-lg px-3 py-3 text-[15px] font-medium text-brand hover:bg-white/10"
              >
                <LockIcon size={20} />
                c+
              </Link>

              <div className="my-2 border-t border-white/10 pt-2"></div>

              <a
                href={getTelegramLink()}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-4 rounded-lg px-3 py-3 text-[15px] font-medium text-white/90 hover:bg-white/10 hover:text-white"
              >
                <SendIcon size={20} className="text-sky-400" />
                Telegram
              </a>
              <a
                href={getContactLink()}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-4 rounded-lg px-3 py-3 text-[15px] font-medium text-white/90 hover:bg-white/10 hover:text-white"
              >
                <PhoneCallIcon size={20} className="text-green-400" />
                Contact
              </a>
            </div>

            <div className="border-t border-white/15 p-4 text-center text-[11px] text-white/40 flex flex-col gap-0.5">
              <span>Marketify Portal v2.0</span>
              <span className="text-[9px] opacity-40 select-none">Admin Panel Access</span>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
