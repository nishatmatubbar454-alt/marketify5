import React, { useState } from 'react';
import { useAppLock } from '../../contexts/AppLockContext';
import { Fingerprint, Delete, KeyRound, X } from 'lucide-react';

export function AppLockScreen() {
  const {
    isLocked,
    isSettingUp,
    hasPasscode,
    currentPin,
    unlockApp,
    setupPin,
    cancelSetup,
    authenticateBiometric
  } = useAppLock();

  const [enteredPin, setEnteredPin] = useState('');
  const [setupStep, setSetupStep] = useState<1 | 2>(1);
  const [firstPasscode, setFirstPasscode] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isShaking, setIsShaking] = useState(false);

  // Forgot password modal state
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [masterInput, setMasterInput] = useState('');
  const [isMasterVerified, setIsMasterVerified] = useState(false);
  const [masterError, setMasterError] = useState('');
  const [newResetPin, setNewResetPin] = useState('');
  const [resetSuccessMessage, setResetSuccessMessage] = useState('');

  // If app is not locked and not in setup, do not render
  if (!isLocked && !isSettingUp) return null;

  const triggerVibrate = (ms = 15) => {
    try {
      if (typeof window !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate(ms);
      }
    } catch {}
  };

  const handleKeyPress = (digit: string) => {
    triggerVibrate();
    if (enteredPin.length >= 4) return;
    const next = enteredPin + digit;
    setEnteredPin(next);
    setErrorMessage('');

    if (next.length === 4) {
      if (isSettingUp) {
        if (setupStep === 1) {
          // Step 1: Record first entry, proceed to confirmation
          setFirstPasscode(next);
          setEnteredPin('');
          setSetupStep(2);
        } else {
          // Step 2: Confirm match
          if (next === firstPasscode) {
            setupPin(next);
            setEnteredPin('');
            setSetupStep(1);
          } else {
            triggerVibrate(60);
            setIsShaking(true);
            setErrorMessage('পাসকোড দুটি মিলেনি! আবার চেষ্টা করুন');
            setTimeout(() => {
              setIsShaking(false);
              setEnteredPin('');
              setSetupStep(1);
            }, 650);
          }
        }
      } else {
        // Unlock check: User PIN or universal master 8888
        const success = unlockApp(next);
        if (!success) {
          triggerVibrate(80);
          setIsShaking(true);
          setErrorMessage('ভুল পাসকোড! আবার চেষ্টা করুন');
          setTimeout(() => {
            setIsShaking(false);
            setEnteredPin('');
          }, 500);
        } else {
          setEnteredPin('');
        }
      }
    }
  };

  const handleDelete = () => {
    triggerVibrate(10);
    setEnteredPin((prev) => prev.slice(0, -1));
    setErrorMessage('');
  };

  const handleBiometricClick = async () => {
    triggerVibrate(20);
    const success = await authenticateBiometric();
    if (success) {
      setEnteredPin('');
    }
  };

  return (
    <div className="fixed inset-0 z-[99999] flex flex-col items-center justify-center bg-black/95 px-4 py-6 backdrop-blur-2xl animate-in fade-in duration-200 overflow-y-auto">
      {/* Background ambient red glow */}
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_center,rgba(220,38,38,0.22)_0%,transparent_75%)]" />

      {/* Main Lock Card */}
      <div className="relative w-full max-w-[340px] sm:max-w-[360px] rounded-[34px] border-2 border-red-600/80 bg-[#0e0305]/95 p-6 sm:p-7 shadow-[0_0_55px_rgba(220,38,38,0.45)] backdrop-blur-3xl flex flex-col items-center">
        {/* Cancel button if user opened setup without locking */}
        {isSettingUp && !hasPasscode && (
          <button
            type="button"
            onClick={cancelSetup}
            className="absolute top-3.5 right-3.5 grid h-7 w-7 place-items-center rounded-full text-white/50 hover:bg-white/10 hover:text-white transition-colors"
            aria-label="Close"
          >
            <X size={17} />
          </button>
        )}

        {/* 3D Glossy Red Play Button Icon */}
        <div className="relative mb-3 flex items-center justify-center">
          <div className="relative h-15 w-15 sm:h-16 sm:w-16 rounded-2xl bg-gradient-to-br from-red-500 via-red-600 to-red-950 p-1 shadow-[0_0_28px_rgba(239,68,68,0.7)] flex items-center justify-center">
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-t from-transparent via-white/20 to-white/40 pointer-events-none" />
            <div className="ml-1 w-0 h-0 border-y-[11px] border-y-transparent border-l-[19px] border-l-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)]" />
          </div>
        </div>

        {/* Title */}
        <h2 className="text-[21px] sm:text-[23px] font-bold text-red-500 tracking-tight text-center drop-shadow-[0_0_12px_rgba(239,68,68,0.6)]">
          {isSettingUp
            ? setupStep === 1
              ? 'নতুন পাসওয়ার্ড সেট করুন'
              : 'পাসওয়ার্ড নিশ্চিত করুন'
            : 'Enter a passcode'}
        </h2>

        {/* Setup explanation only during setup */}
        {isSettingUp && (
          <p className="mt-1 text-[11.5px] text-white/70 text-center leading-tight">
            {setupStep === 1
              ? 'লক করার জন্য যেকোনো ৪ সংখ্যার পিন লিখুন'
              : 'নিশ্চিত করার জন্য আবার একই ৪ সংখ্যা দিন'}
          </p>
        )}

        {/* 4 Neon Squircle Indicators */}
        <div
          className={`mt-4 mb-5 flex items-center justify-center gap-3 transition-transform ${
            isShaking ? 'animate-shake' : ''
          }`}
        >
          {[0, 1, 2, 3].map((index) => {
            const isFilled = enteredPin.length > index;
            return (
              <div
                key={index}
                className={`grid h-11 w-11 sm:h-12 sm:w-12 place-items-center rounded-2xl border-2 transition-all duration-150 ${
                  isFilled
                    ? 'border-red-500 bg-red-600/35 shadow-[0_0_20px_rgba(239,68,68,0.85)] scale-105'
                    : 'border-red-600/50 bg-[#190508]/80 shadow-[0_0_8px_rgba(220,38,38,0.25)]'
                }`}
              >
                {isFilled && (
                  <div className="h-3 w-3 rounded-full bg-white shadow-[0_0_10px_#fff]" />
                )}
              </div>
            );
          })}
        </div>

        {/* Error Message */}
        {errorMessage && (
          <p className="mb-2 text-[12px] font-semibold text-red-400 text-center leading-tight">
            {errorMessage}
          </p>
        )}

        {/* Numeric Keypad with Red Neon Circles and Underlines */}
        <div className="w-full grid grid-cols-3 gap-x-4 gap-y-3 max-w-[270px]">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
            <button
              key={digit}
              type="button"
              onClick={() => handleKeyPress(digit)}
              className="group relative flex h-14 w-14 sm:h-15 sm:w-15 flex-col items-center justify-center rounded-full border-2 border-red-600/70 bg-gradient-to-b from-[#25080c] to-[#120305] shadow-[0_0_14px_rgba(220,38,38,0.3)] active:scale-90 active:border-red-400 active:shadow-[0_0_26px_rgba(239,68,68,0.9)] transition-all mx-auto select-none"
            >
              <span className="text-[21px] sm:text-[23px] font-bold text-white leading-none">
                {digit}
              </span>
              <span className="mt-1 h-[2px] w-3 rounded-full bg-red-500 shadow-[0_0_4px_rgba(239,68,68,0.8)]" />
            </button>
          ))}

          {/* Bottom Row: Fingerprint, 0, Backspace */}
          <button
            type="button"
            onClick={handleBiometricClick}
            aria-label="Fingerprint / Biometric Unlock"
            className="group relative flex h-14 w-14 sm:h-15 sm:w-15 flex-col items-center justify-center rounded-full border-2 border-red-600/70 bg-gradient-to-b from-[#25080c] to-[#120305] shadow-[0_0_14px_rgba(220,38,38,0.3)] active:scale-90 active:border-red-400 active:shadow-[0_0_26px_rgba(239,68,68,0.9)] transition-all mx-auto text-red-400 hover:text-red-300 select-none"
          >
            <Fingerprint size={21} className="stroke-[2.2]" />
            <span className="mt-1 h-[2px] w-3 rounded-full bg-red-500/60" />
          </button>

          <button
            type="button"
            onClick={() => handleKeyPress('0')}
            className="group relative flex h-14 w-14 sm:h-15 sm:w-15 flex-col items-center justify-center rounded-full border-2 border-red-600/70 bg-gradient-to-b from-[#25080c] to-[#120305] shadow-[0_0_14px_rgba(220,38,38,0.3)] active:scale-90 active:border-red-400 active:shadow-[0_0_26px_rgba(239,68,68,0.9)] transition-all mx-auto select-none"
          >
            <span className="text-[21px] sm:text-[23px] font-bold text-white leading-none">
              0
            </span>
            <span className="mt-1 h-[2px] w-3 rounded-full bg-red-500 shadow-[0_0_4px_rgba(239,68,68,0.8)]" />
          </button>

          <button
            type="button"
            onClick={handleDelete}
            aria-label="Delete last digit"
            className="group relative flex h-14 w-14 sm:h-15 sm:w-15 flex-col items-center justify-center rounded-full border-2 border-red-600/70 bg-gradient-to-b from-[#25080c] to-[#120305] shadow-[0_0_14px_rgba(220,38,38,0.3)] active:scale-90 active:border-red-400 active:shadow-[0_0_26px_rgba(239,68,68,0.9)] transition-all mx-auto text-red-400 hover:text-red-300 select-none"
          >
            <Delete size={20} className="stroke-[2.2]" />
            <span className="mt-1 h-[2px] w-3 rounded-full bg-red-500/60" />
          </button>
        </div>
      </div>

      {/* Clean Underlined Forgot Password Text right-aligned at bottom */}
      {!isSettingUp && (
        <div className="w-full max-w-[340px] sm:max-w-[360px] flex justify-end mt-3.5 px-1">
          <button
            type="button"
            onClick={() => {
              setShowForgotModal(true);
              setMasterInput('');
              setIsMasterVerified(false);
              setMasterError('');
              setNewResetPin('');
              setResetSuccessMessage('');
            }}
            className="text-[13px] sm:text-[14px] font-medium text-red-400 hover:text-red-300 underline underline-offset-4 decoration-red-500/60 hover:decoration-red-400 active:opacity-75 transition-all select-none"
          >
            Forgot password?
          </button>
        </div>
      )}

      {/* Forgot Password / Reset Modal */}
      {showForgotModal && (
        <div className="fixed inset-0 z-[100000] flex items-center justify-center bg-black/85 p-4 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-[320px] rounded-3xl border-2 border-red-500/50 bg-[#160608] p-5 text-white shadow-2xl">
            <div className="flex items-center justify-between pb-2.5 border-b border-white/10">
              <div className="flex items-center gap-2">
                <KeyRound size={18} className="text-red-500" />
                <h3 className="text-[14px] font-bold">পাসওয়ার্ড রিকভারি ও রিসেট</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowForgotModal(false)}
                className="grid h-7 w-7 place-items-center rounded-full text-white/60 hover:text-white"
              >
                <X size={17} />
              </button>
            </div>

            <div className="py-3 space-y-3">
              {!isMasterVerified ? (
                <>
                  <div className="rounded-xl bg-red-500/10 border border-red-500/30 p-2.5 text-[12px] text-white/90">
                    <p className="leading-snug">
                      অরিজিনাল পাসওয়ার্ড দেখতে বা রিসেট করতে আগে <span className="font-mono text-red-400 font-bold">8888</span> টাইপ করুন:
                    </p>
                  </div>

                  <div>
                    <input
                      type="password"
                      maxLength={4}
                      value={masterInput}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, '').slice(0, 4);
                        setMasterInput(val);
                        setMasterError('');
                        if (val === '8888') {
                          setIsMasterVerified(true);
                        }
                      }}
                      placeholder="8888"
                      className="w-full rounded-xl bg-black/60 border border-white/20 px-3 py-2 text-center font-mono text-xl tracking-[0.4em] text-white focus:outline-none focus:border-red-400"
                    />
                  </div>

                  {masterError && (
                    <p className="text-[11.5px] text-red-400 text-center font-medium">
                      {masterError}
                    </p>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      if (masterInput === '8888') {
                        setIsMasterVerified(true);
                      } else {
                        setMasterError('কোড সঠিক নয়! 8888 টাইপ করুন');
                      }
                    }}
                    className="w-full rounded-xl bg-gradient-to-r from-red-600 to-red-700 py-2.5 text-[12px] font-bold text-white shadow-md active:scale-95 transition-all"
                  >
                    যাচাই করে পাসওয়ার্ড দেখুন
                  </button>
                </>
              ) : (
                <>
                  {/* Verified with 8888: Now display original password */}
                  <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/40 p-3 text-center">
                    <span className="text-[11px] text-emerald-300 block">আপনার অরিজিনাল পাসওয়ার্ড:</span>
                    <span className="font-mono text-2xl font-bold text-amber-400 tracking-widest mt-1 block">
                      {currentPin || '৮৮৮৮ (সেট করা নেই)'}
                    </span>
                  </div>

                  {/* Direct Unlock Button */}
                  <button
                    type="button"
                    onClick={() => {
                      unlockApp('8888');
                      setShowForgotModal(false);
                    }}
                    className="w-full rounded-xl bg-gradient-to-r from-red-600 to-red-700 py-2 text-[12px] font-bold text-white shadow-md active:scale-95 transition-all"
                  >
                    8888 দিয়ে এখনই লক খুলুন
                  </button>

                  {/* Reset to New Pin Section */}
                  <div className="pt-2 border-t border-white/10">
                    <label className="block text-[11px] font-medium text-white/70 mb-1">
                      নতুন ৪ সংখ্যার পাসওয়ার্ড সেট করুন:
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="password"
                        maxLength={4}
                        value={newResetPin}
                        onChange={(e) => {
                          const val = e.target.value.replace(/\D/g, '').slice(0, 4);
                          setNewResetPin(val);
                          setResetSuccessMessage('');
                        }}
                        placeholder="যেমন: 1234"
                        className="flex-1 rounded-xl bg-black/60 border border-white/20 px-3 py-2 text-center font-mono text-base tracking-widest text-white focus:outline-none focus:border-red-400"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (newResetPin.length === 4) {
                            setupPin(newResetPin);
                            setResetSuccessMessage('পাসওয়ার্ড সংরক্ষিত হয়েছে!');
                            setTimeout(() => {
                              setShowForgotModal(false);
                            }, 800);
                          }
                        }}
                        disabled={newResetPin.length !== 4}
                        className="rounded-xl bg-emerald-600 px-3 py-2 text-[11px] font-bold text-white disabled:opacity-40 transition-all active:scale-95"
                      >
                        সেভ
                      </button>
                    </div>
                    {resetSuccessMessage && (
                      <p className="mt-1 text-[11px] text-emerald-400 text-center font-medium">
                        ✓ {resetSuccessMessage}
                      </p>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
