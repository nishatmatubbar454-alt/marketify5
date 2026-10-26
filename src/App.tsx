/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { ThemeProvider } from './contexts/ThemeContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
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

function RequireRole({ children }: { children: React.ReactNode }) {
  const { session } = useAuth();
  if (!session || session.role !== 'admin') return <Navigate to="/erfan" replace />;
  return <>{children}</>;
}

function AdminEntry() {
  const { session } = useAuth();
  if (session && session.role === 'admin') return <Navigate to="/erfan/dashboard" replace />;
  return <Login />;
}

function PublicHeaderBanner() {
  const location = useLocation();
  if (location.pathname.startsWith('/erfan')) return null;
  return <AppInstallBanner />;
}

export function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
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
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
