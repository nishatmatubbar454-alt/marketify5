import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { HandshakeIcon, LockIcon } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

export function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await login(password);
      navigate('/erfan/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid min-h-screen w-full place-items-center bg-[#0f0f0f] px-4">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm rounded-xl bg-[#181818] p-6 ring-1 ring-white/10"
      >
        <div className="mb-5 flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-full bg-brand text-[#0f0f0f]">
            <HandshakeIcon size={18} strokeWidth={2.5} />
          </span>
          <span className="text-[20px] font-bold text-brand">Marketify</span>
        </div>
        <h1 className="text-[17px] font-semibold text-white">Erfan Portal Login</h1>
        <p className="mt-1 text-[13px] text-white/50">
          Enter password to manage videos.
        </p>

        <label htmlFor="password" className="mt-5 block text-[12px] font-medium uppercase tracking-wide text-white/50">
          Password
        </label>
        <div className="mt-1.5 flex items-center gap-2 rounded-md bg-white/10 px-3">
          <LockIcon size={15} className="text-white/40" />
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            className="w-full bg-transparent py-2.5 text-[14px] text-white placeholder:text-white/30 focus:outline-none"
            placeholder="Enter password..."
          />
        </div>

        {error && (
          <p role="alert" className="mt-3 text-[13px] text-red-400">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={busy}
          className="mt-5 w-full rounded-md bg-brand py-2.5 text-[14px] font-semibold text-[#0f0f0f] transition-opacity duration-150 ease-out disabled:opacity-60"
        >
          {busy ? 'Signing in...' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}
