import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { ArrowLeftIcon, HandshakeIcon, LogOutIcon, ShieldCheckIcon } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

interface AdminLayoutProps {
  title: string;
  children: React.ReactNode;
}

export function AdminLayout({ title, children }: AdminLayoutProps) {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const links = [
    { to: '/erfan/add', label: 'Post Add' },
    { to: '/erfan/dashboard', label: 'Post History' },
    { to: '/erfan/ads', label: 'Ads Management' },
    { to: '/erfan/settings', label: 'Settings' }
  ];

  return (
    <div className="min-h-screen w-full bg-[#f4f4f4] dark:bg-[#101010]">
      <header className="bg-[#0f0f0f] border-b border-white/10">
        <div className="mx-auto flex h-14 w-full max-w-[1100px] items-center gap-3 px-3">
          <button
            type="button"
            onClick={() => navigate('/')}
            aria-label="Back to site"
            className="flex items-center gap-1.5 rounded-md bg-white/10 px-3 py-1.5 text-[13px] font-medium text-white transition-colors duration-150 ease-out hover:bg-white/20"
          >
            <ArrowLeftIcon size={15} />
            Back to Site
          </button>
          <span className="grid h-7 w-7 place-items-center rounded-full bg-brand text-[#0f0f0f]">
            <HandshakeIcon size={17} strokeWidth={2.5} />
          </span>
          <span className="text-[17px] font-bold text-brand">Marketify</span>

          {/* Zero Ads Guarantee Badge */}
          <div className="hidden sm:flex items-center gap-1 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs px-2.5 py-1 rounded-full font-medium">
            <ShieldCheckIcon size={14} />
            Ads Disabled Here
          </div>

          <div className="flex-1" />

          <button
            type="button"
            onClick={() => {
              logout();
              navigate('/erfan');
            }}
            className="flex items-center gap-1.5 rounded-md bg-white/10 px-3 py-1.5 text-[13px] text-white transition-colors duration-150 ease-out hover:bg-white/20"
          >
            <LogOutIcon size={14} />
            Logout
          </button>
        </div>
      </header>

      <div className="mx-auto w-full max-w-[1100px] px-3 py-4">
        <nav className="mb-4 flex gap-1 overflow-x-auto pb-1" aria-label="Admin navigation">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) =>
                `whitespace-nowrap rounded-md px-3.5 py-2 text-[13px] font-medium transition-colors duration-150 ease-out ${
                  isActive
                    ? 'bg-[#0f0f0f] text-white dark:bg-white dark:text-[#0f0f0f]'
                    : 'bg-white text-[#404040] hover:bg-black/5 dark:bg-panel dark:text-white/70 dark:hover:bg-white/10'
                }`
              }
            >
              {link.label}
            </NavLink>
          ))}
        </nav>

        <h1 className="mb-3 text-[20px] font-bold text-[#0f0f0f] dark:text-white">{title}</h1>
        {children}
      </div>
    </div>
  );
}
