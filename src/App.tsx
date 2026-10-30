/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { ThemeProvider } from './contexts/ThemeContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { AppLockProvider } from './contexts/AppLockContext';
import { AppLockScreen } from './components/lock/AppLockScreen';
import { SocialBarAds } from './components/SocialBarAds';
import { BottomNav } from './components/BottomNav';
import { AppInstallBanner } from './components/AppInstallBanner';
import { Home } from './pages/Home';
import { VideoPage } from './pages/VideoPage';
import { TrendingPage } from './pages/TrendingPage';
import { HistoryPage } from './pages/HistoryPage';
import { FavoritesPage } from './pages/FavoritesPage';
import { Login } from './pages/admin/Login';
import { Dashboard } from './pages/admin/Dashboard';
import { AddVideo } from './pages/admin/AddVideo';
import { AdsManagement } from './pages/admin/AdsManagement';
import { Settings } from './pages/admin/Settings';
import { DeviceAnalytics } from './pages/admin/DeviceAnalytics';
import { RecycleBin } from './pages/admin/RecycleBin';

function RequireRole({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();
  if (loading) {
    return <div className="min-h-screen grid place-items-center bg-[#0f0f0f] text-white/50 text-sm">যাচাই করা হচ্ছে...</div>;
  }
  if (!session || session.role !== 'admin') return <Navigate to="/erfan" replace />;
  return <>{children}</>;
}

function AdminEntry() {
  const { session, loading } = useAuth();
  if (loading) {
    return <div className="min-h-screen grid place-items-center bg-[#0f0f0f] text-white/50 text-sm">যাচাই করা হচ্ছে...</div>;
  }
  if (session && session.role === 'admin') return <Navigate to="/erfan/dashboard" replace />;
  return <Login />;
}

function PublicHeaderBanner() {
  const location = useLocation();
  if (location.pathname.startsWith('/erfan')) return null;
  return <AppInstallBanner />;
}

import { trackDevicePresence, recordAppInstall } from './utils/analytics';

export function App() {
  React.useEffect(() => {
    trackDevicePresence();
    const handleInstalled = () => {
      recordAppInstall();
    };
    window.addEventListener('appinstalled', handleInstalled);
    return () => {
      window.removeEventListener('appinstalled', handleInstalled);
    };
  }, []);

  return (
    <ThemeProvider>
      <AuthProvider>
        <AppLockProvider>
          <AppLockScreen />
          <BrowserRouter>
          <PublicHeaderBanner />
          <SocialBarAds />
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/trending" element={<TrendingPage />} />
            <Route path="/history" element={<HistoryPage />} />
            <Route path="/favorites" element={<FavoritesPage />} />
            <Route path="/video/:id" element={<VideoPage />} />
            <Route path="/erfan" element={<AdminEntry />} />
            <Route
              path="/erfan/dashboard"
              element={
                <RequireRole>
                  <Dashboard />
                </RequireRole>
              }
            />
            <Route
              path="/erfan/trash"
              element={
                <RequireRole>
                  <RecycleBin />
                </RequireRole>
              }
            />
            <Route
              path="/erfan/add"
              element={
                <RequireRole>
                  <AddVideo />
                </RequireRole>
              }
            />
            <Route
              path="/erfan/edit/:id"
              element={
                <RequireRole>
                  <AddVideo />
                </RequireRole>
              }
            />
            <Route
              path="/erfan/analytics"
              element={
                <RequireRole>
                  <DeviceAnalytics />
                </RequireRole>
              }
            />
            <Route
              path="/erfan/ads"
              element={
                <RequireRole>
                  <AdsManagement />
                </RequireRole>
              }
            />
            <Route
              path="/erfan/settings"
              element={
                <RequireRole>
                  <Settings />
                </RequireRole>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          <BottomNav />
        </BrowserRouter>
        </AppLockProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
