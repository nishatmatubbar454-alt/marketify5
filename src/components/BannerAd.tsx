import React from 'react';
import { useLocation } from 'react-router-dom';
import { useAds } from '../hooks/useAds';

export function BannerAd() {
  const { banner } = useAds();
  const { pathname } = useLocation();
  const isAdminRoute = pathname.startsWith('/admin') || pathname.startsWith('/erfan');

  // CRITICAL: Never render banner ads if user is in the Admin Panel
  if (isAdminRoute) return null;

  const script = banner?.status === 'on' ? banner.script : '';
  if (!script) return null;

  const srcdoc = `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body{margin:0;padding:0;overflow:hidden;background:transparent;display:flex;justify-content:center;align-items:center;height:100%}</style></head><body>${script}</body></html>`;

  return (
    <div className="w-full overflow-hidden my-3 flex justify-center">
      <div className="mx-auto w-full max-w-[468px] overflow-hidden rounded-md flex justify-center bg-black/5 dark:bg-white/5 p-1">
        <iframe
          key={script}
          srcDoc={srcdoc}
          title="Advertisement"
          width={468}
          height={68}
          sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-top-navigation allow-presentation"
          scrolling="no"
          className="block h-[68px] w-[468px] border-0"
        />
      </div>
    </div>
  );
}
