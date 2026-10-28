import React from 'react';
import { useAppLock } from '../../contexts/AppLockContext';
import { Lock, LockOpen } from 'lucide-react';

export function LockHeaderButton() {
  const { isLocked, hasPasscode, lockApp, startSetup } = useAppLock();

  const handleClick = () => {
    if (!hasPasscode) {
      startSetup();
    } else {
      lockApp();
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label="App Lock / অ্যাপ লক"
      title={hasPasscode ? 'অ্যাপ লক করুন (Click to Lock)' : 'পাসওয়ার্ড সেটআপ করুন (Setup Lock)'}
      className="relative grid h-10 w-10 place-items-center rounded-full text-[#0f0f0f] dark:text-white hover:bg-black/5 dark:hover:bg-white/10 active:scale-90 transition-all select-none shrink-0"
    >
      {isLocked ? (
        <Lock size={20} className="stroke-[2.2]" />
      ) : (
        <LockOpen size={20} className="stroke-[2.2]" />
      )}
    </button>
  );
}
