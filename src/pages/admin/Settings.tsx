import React, { useState } from 'react';
import { AdminLayout } from '../../components/admin/AdminLayout';
import { useAuth } from '../../contexts/AuthContext';
import { getImgBBKey, setImgBBKey } from '../../utils/uploadImage';
import { getContactLink, getTelegramLink, setContactLink, setTelegramLink } from '../../utils/helpers';

const DEFAULT_FIREBASE_CONFIG_STR = JSON.stringify({
  apiKey: "AIzaSyDaDfql5hzf8CCFAOVNX0c8xeyfsVJWYQg",
  authDomain: "himrw-fae65.firebaseapp.com",
  databaseURL: "https://himrw-fae65-default-rtdb.firebaseio.com",
  projectId: "himrw-fae65",
  storageBucket: "himrw-fae65.firebasestorage.app",
  messagingSenderId: "697331272278",
  appId: "1:697331272278:web:fb1ed4bc02d4397a78c9f7",
  measurementId: "G-L5EF52FPXW"
}, null, 2);

export function Settings() {
  const { updatePassword, getAdminPassword } = useAuth();
  
  // Password state
  const [currentPass, setCurrentPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [passMsg, setPassMsg] = useState('');
  const [passError, setPassError] = useState('');

  // ImgBB API Key state
  const [imgbbKey, setImgbbKeyInput] = useState(() => getImgBBKey());
  const [imgbbMsg, setImgbbMsg] = useState('');

  // Telegram & Contact link state
  const [telegramUrl, setTelegramUrl] = useState(() => getTelegramLink());
  const [contactUrl, setContactUrl] = useState(() => getContactLink());
  const [socialMsg, setSocialMsg] = useState('');

  // Firebase Config state
  const [fbConfigStr, setFbConfigStr] = useState(() => {
    try {
      const saved = localStorage.getItem('mk-firebase-config');
      if (saved) return JSON.stringify(JSON.parse(saved), null, 2);
    } catch {}
    return DEFAULT_FIREBASE_CONFIG_STR;
  });
  const [fbMsg, setFbMsg] = useState('');
  const [fbError, setFbError] = useState('');

  const handleChangePassword = (e: React.FormEvent) => {
    e.preventDefault();
    setPassError('');
    setPassMsg('');
    if (currentPass !== getAdminPassword()) {
      setPassError('Current password is incorrect.');
      return;
    }
    if (newPass.trim().length < 4) {
      setPassError('New password must be at least 4 characters.');
      return;
    }
    updatePassword(newPass.trim());
    setPassMsg('Password updated successfully!');
    setCurrentPass('');
    setNewPass('');
    window.setTimeout(() => setPassMsg(''), 2500);
  };

  const handleSaveImgBB = (e: React.FormEvent) => {
    e.preventDefault();
    setImgBBKey(imgbbKey);
    setImgbbMsg('ImgBB API Key saved successfully!');
    window.setTimeout(() => setImgbbMsg(''), 2500);
  };

  const handleSaveSocialLinks = (e: React.FormEvent) => {
    e.preventDefault();
    setTelegramLink(telegramUrl.trim());
    setContactLink(contactUrl.trim());
    setSocialMsg('Telegram & Contact links updated successfully!');
    window.setTimeout(() => setSocialMsg(''), 2500);
  };

  const handleSaveFirebase = (e: React.FormEvent) => {
    e.preventDefault();
    setFbError('');
    setFbMsg('');
    try {
      const parsed = JSON.parse(fbConfigStr);
      if (!parsed.projectId || !parsed.apiKey) {
        throw new Error('Invalid Firebase config JSON (apiKey and projectId required).');
      }
      localStorage.setItem('mk-firebase-config', JSON.stringify(parsed));
      setFbMsg('Firebase configuration updated successfully! Reloading...');
      window.setTimeout(() => {
        window.location.reload();
      }, 1200);
    } catch (err) {
      setFbError(err instanceof Error ? err.message : 'Invalid JSON format.');
    }
  };

  return (
    <AdminLayout title="Settings">
      <div className="max-w-2xl space-y-6 pb-12">
        {/* 1. Telegram & Contact Links Management */}
        <section className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-black/5 dark:bg-panel dark:ring-white/5">
          <h2 className="text-[16px] font-semibold text-[#0f0f0f] dark:text-white">
            Telegram & Contact Links
          </h2>
          <p className="mt-1 text-[12px] text-[#606060] dark:text-white/50">
            Configure links for sidebar menu buttons.
          </p>
          <form onSubmit={handleSaveSocialLinks} className="mt-3 space-y-3">
            <label className="block">
              <span className="block text-[12px] font-semibold uppercase tracking-wide text-[#606060] dark:text-white/50">
                Telegram URL
              </span>
              <input
                type="text"
                value={telegramUrl}
                onChange={(e) => setTelegramUrl(e.target.value)}
                placeholder="https://t.me/yourchannel"
                className="mt-1.5 w-full rounded-md bg-black/5 px-3 py-2.5 text-[13px] text-[#0f0f0f] focus:outline-none focus:ring-1 focus:ring-brand dark:bg-white/10 dark:text-white"
              />
            </label>
            <label className="block">
              <span className="block text-[12px] font-semibold uppercase tracking-wide text-[#606060] dark:text-white/50">
                Contact / Support URL
              </span>
              <input
                type="text"
                value={contactUrl}
                onChange={(e) => setContactUrl(e.target.value)}
                placeholder="https://t.me/yoursupport"
                className="mt-1.5 w-full rounded-md bg-black/5 px-3 py-2.5 text-[13px] text-[#0f0f0f] focus:outline-none focus:ring-1 focus:ring-brand dark:bg-white/10 dark:text-white"
              />
            </label>
            {socialMsg && <p className="text-[13px] font-medium text-green-600">{socialMsg}</p>}
            <button
              type="submit"
              className="rounded-md bg-brand px-4 py-2 text-[13px] font-bold text-[#0f0f0f]"
            >
              Save Links
            </button>
          </form>
        </section>

        {/* 2. ImgBB API Management */}
        <section className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-black/5 dark:bg-panel dark:ring-white/5">
          <h2 className="text-[16px] font-semibold text-[#0f0f0f] dark:text-white">
            ImgBB API Management
          </h2>
          <p className="mt-1 text-[12px] text-[#606060] dark:text-white/50">
            Set custom ImgBB API key for image hosting.
          </p>
          <form onSubmit={handleSaveImgBB} className="mt-3 space-y-3">
            <label className="block">
              <span className="block text-[12px] font-semibold uppercase tracking-wide text-[#606060] dark:text-white/50">
                ImgBB API Key
              </span>
              <input
                type="text"
                value={imgbbKey}
                onChange={(e) => setImgbbKeyInput(e.target.value)}
                placeholder="Enter ImgBB API key..."
                className="mt-1.5 w-full rounded-md bg-black/5 px-3 py-2.5 font-mono text-[13px] text-[#0f0f0f] focus:outline-none focus:ring-1 focus:ring-brand dark:bg-white/10 dark:text-white"
              />
            </label>
            {imgbbMsg && <p className="text-[13px] font-medium text-green-600">{imgbbMsg}</p>}
            <button
              type="submit"
              className="rounded-md bg-brand px-4 py-2 text-[13px] font-bold text-[#0f0f0f]"
            >
              Save ImgBB Key
            </button>
          </form>
        </section>

        {/* 3. Change Password */}
        <section className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-black/5 dark:bg-panel dark:ring-white/5">
          <h2 className="text-[16px] font-semibold text-[#0f0f0f] dark:text-white">
            Change Password
          </h2>
          <p className="mt-1 text-[12px] text-[#606060] dark:text-white/50">
            Update your login password.
          </p>
          <form onSubmit={handleChangePassword} className="mt-3 space-y-3">
            <label className="block">
              <span className="block text-[12px] font-semibold uppercase tracking-wide text-[#606060] dark:text-white/50">
                Current Password
              </span>
              <input
                type="password"
                value={currentPass}
                onChange={(e) => setCurrentPass(e.target.value)}
                placeholder="Enter current password..."
                className="mt-1.5 w-full rounded-md bg-black/5 px-3 py-2.5 text-[14px] text-[#0f0f0f] focus:outline-none focus:ring-1 focus:ring-brand dark:bg-white/10 dark:text-white"
              />
            </label>
            <label className="block">
              <span className="block text-[12px] font-semibold uppercase tracking-wide text-[#606060] dark:text-white/50">
                New Password
              </span>
              <input
                type="password"
                value={newPass}
                onChange={(e) => setNewPass(e.target.value)}
                placeholder="Enter new password..."
                className="mt-1.5 w-full rounded-md bg-black/5 px-3 py-2.5 text-[14px] text-[#0f0f0f] focus:outline-none focus:ring-1 focus:ring-brand dark:bg-white/10 dark:text-white"
              />
            </label>
            {passError && <p className="text-[13px] text-red-600">{passError}</p>}
            {passMsg && <p className="text-[13px] font-medium text-green-600">{passMsg}</p>}
            <button
              type="submit"
              className="rounded-md bg-brand px-4 py-2 text-[13px] font-bold text-[#0f0f0f]"
            >
              Update Password
            </button>
          </form>
        </section>

        {/* 4. Firebase Configuration Management */}
        <section className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-black/5 dark:bg-panel dark:ring-white/5">
          <h2 className="text-[16px] font-semibold text-[#0f0f0f] dark:text-white">
            Firebase Configuration
          </h2>
          <p className="mt-1 text-[12px] text-[#606060] dark:text-white/50">
            Provide custom Firebase config JSON.
          </p>
          <form onSubmit={handleSaveFirebase} className="mt-3 space-y-3">
            <label className="block">
              <span className="block text-[12px] font-semibold uppercase tracking-wide text-[#606060] dark:text-white/50">
                Firebase Config JSON
              </span>
              <textarea
                value={fbConfigStr}
                onChange={(e) => setFbConfigStr(e.target.value)}
                rows={8}
                spellCheck={false}
                className="mt-1.5 w-full rounded-md bg-black/5 p-3 font-mono text-[12px] leading-5 text-[#0f0f0f] focus:outline-none focus:ring-1 focus:ring-brand dark:bg-white/10 dark:text-white"
              />
            </label>
            {fbError && <p className="text-[13px] text-red-600">{fbError}</p>}
            {fbMsg && <p className="text-[13px] font-medium text-green-600">{fbMsg}</p>}
            <button
              type="submit"
              className="rounded-md bg-brand px-4 py-2 text-[13px] font-bold text-[#0f0f0f]"
            >
              Save & Reload Firebase
            </button>
          </form>
        </section>
      </div>
    </AdminLayout>
  );
}
