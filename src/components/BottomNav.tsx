import React from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { Home, Flame, Clock, Heart } from 'lucide-react';

export function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();

  // Hide on admin panel routes
  if (location.pathname.startsWith('/erfan')) {
    return null;
  }

  const handleTabClick = (targetPath: string) => {
    if (location.pathname === targetPath) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleCenterClick = () => {
    if (location.pathname === '/') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      navigate('/');
    }
  };

  return (
    <nav
      aria-label="Bottom Navigation"
      className="fixed bottom-2 sm:bottom-3 inset-x-0 z-40 px-2 sm:px-3 flex justify-center pointer-events-none select-none"
    >
      <div className="pointer-events-auto w-full max-w-[340px] sm:max-w-[370px] bg-[#fffdf9]/95 dark:bg-[#181817]/95 backdrop-blur-md rounded-full px-2.5 py-1 sm:py-1.5 shadow-[0_8px_24px_rgba(40,25,10,0.14)] dark:shadow-[0_8px_28px_rgba(0,0,0,0.65)] border border-[#ebdcc7]/90 dark:border-white/10 flex items-center justify-between relative transition-all">
        
        {/* Left: Home & Trending */}
        <div className="flex items-center justify-around flex-1 pr-0.5">
          {/* 1. Home */}
          <NavLink
            to="/"
            end
            onClick={() => handleTabClick('/')}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center min-w-[46px] py-0.5 transition-all duration-150 active:scale-90 group ${
                isActive
                  ? 'text-[#d97706] dark:text-[#f59e0b]'
                  : 'text-[#736c64] hover:text-[#2c2723] dark:text-[#9e9a94] dark:hover:text-white'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <div
                  className={`p-0.5 transition-transform duration-150 group-hover:scale-110 ${
                    isActive ? 'scale-105' : ''
                  }`}
                >
                  <Home
                    size={17}
                    strokeWidth={isActive ? 2.5 : 2}
                    className={isActive ? 'fill-[#d97706]/15 dark:fill-[#f59e0b]/20' : ''}
                  />
                </div>
                <span className={`text-[9.5px] leading-tight mt-0.5 tracking-tight ${isActive ? 'font-bold' : 'font-medium'}`}>
                  Home
                </span>
              </>
            )}
          </NavLink>

          {/* 2. Trending */}
          <NavLink
            to="/trending"
            onClick={() => handleTabClick('/trending')}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center min-w-[46px] py-0.5 transition-all duration-150 active:scale-90 group ${
                isActive
                  ? 'text-[#ea580c] dark:text-[#fb923c]'
                  : 'text-[#736c64] hover:text-[#2c2723] dark:text-[#9e9a94] dark:hover:text-white'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <div
                  className={`p-0.5 transition-transform duration-150 group-hover:scale-110 ${
                    isActive ? 'scale-105' : ''
                  }`}
                >
                  <Flame
                    size={17}
                    strokeWidth={isActive ? 2.5 : 2}
                    className={isActive ? 'fill-[#ea580c]/15 dark:fill-[#fb923c]/20' : ''}
                  />
                </div>
                <span className={`text-[9.5px] leading-tight mt-0.5 tracking-tight ${isActive ? 'font-bold' : 'font-medium'}`}>
                  Trending
                </span>
              </>
            )}
          </NavLink>
        </div>

        {/* Center: Sleek Elevated Emblem with Custom 3D Logo */}
        <div className="relative -top-4 sm:-top-4.5 mx-0.5 shrink-0">
          <button
            type="button"
            onClick={handleCenterClick}
            aria-label="Marketify Hub"
            className="w-12 h-12 sm:w-13 sm:h-13 rounded-full border-[2.5px] border-[#c98e28] dark:border-[#e2a233] bg-[#fffdfa] dark:bg-[#201f1e] shadow-[0_4px_16px_rgba(201,142,40,0.4)] hover:shadow-[0_6px_20px_rgba(201,142,40,0.5)] flex items-center justify-center cursor-pointer hover:scale-105 active:scale-90 transition-all duration-150 overflow-hidden p-0.5 group"
          >
            <img
              src="/app-logo.png"
              alt="Marketify"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).src =
                  'https://i.ibb.co/fVgpTyRP/file-00000000db7881fab842b1c05ce63eaa.png';
              }}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-150"
            />
          </button>
        </div>

        {/* Right: History & Favourite */}
        <div className="flex items-center justify-around flex-1 pl-0.5">
          {/* 3. History */}
          <NavLink
            to="/history"
            onClick={() => handleTabClick('/history')}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center min-w-[46px] py-0.5 transition-all duration-150 active:scale-90 group ${
                isActive
                  ? 'text-[#2563eb] dark:text-[#60a5fa]'
                  : 'text-[#736c64] hover:text-[#2c2723] dark:text-[#9e9a94] dark:hover:text-white'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <div
                  className={`p-0.5 transition-transform duration-150 group-hover:scale-110 ${
                    isActive ? 'scale-105' : ''
                  }`}
                >
                  <Clock
                    size={17}
                    strokeWidth={isActive ? 2.5 : 2}
                    className={isActive ? 'fill-[#2563eb]/15 dark:fill-[#60a5fa]/20' : ''}
                  />
                </div>
                <span className={`text-[9.5px] leading-tight mt-0.5 tracking-tight ${isActive ? 'font-bold' : 'font-medium'}`}>
                  History
                </span>
              </>
            )}
          </NavLink>

          {/* 4. Favourite */}
          <NavLink
            to="/favorites"
            onClick={() => handleTabClick('/favorites')}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center min-w-[46px] py-0.5 transition-all duration-150 active:scale-90 group ${
                isActive
                  ? 'text-[#e11d48] dark:text-[#fb7185]'
                  : 'text-[#736c64] hover:text-[#2c2723] dark:text-[#9e9a94] dark:hover:text-white'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <div
                  className={`p-0.5 transition-transform duration-150 group-hover:scale-110 ${
                    isActive ? 'scale-105' : ''
                  }`}
                >
                  <Heart
                    size={17}
                    strokeWidth={isActive ? 2.5 : 2}
                    className={isActive ? 'fill-[#e11d48] text-[#e11d48]' : ''}
                  />
                </div>
                <span className={`text-[9.5px] leading-tight mt-0.5 tracking-tight ${isActive ? 'font-bold' : 'font-medium'}`}>
                  Favourite
                </span>
              </>
            )}
          </NavLink>
        </div>

      </div>
    </nav>
  );
}
