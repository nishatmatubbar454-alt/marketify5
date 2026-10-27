import React, { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useAds } from '../hooks/useAds';

export const BannerAd = React.memo(function BannerAd() {
  const { banner } = useAds();
  const { pathname } = useLocation();
  const containerRef = useRef<HTMLDivElement>(null);

  // CRITICAL: Never render banner ads if user is in the Admin Panel
  const isAdminRoute = pathname.startsWith('/admin') || pathname.startsWith('/erfan');
  const isEnabled = !isAdminRoute && banner?.status === 'on' && Boolean(banner?.script?.trim());

  useEffect(() => {
    if (!isEnabled || !banner?.script) return;
    const container = containerRef.current;
    if (!container) return;

    // Reset container contents
    container.innerHTML = '';

    // Create a fresh iframe with unrestricted script execution
    const iframe = document.createElement('iframe');
    iframe.style.width = '100%';
    iframe.style.maxWidth = '468px';
    iframe.style.height = '60px';
    iframe.style.border = '0';
    iframe.style.overflow = 'hidden';
    iframe.scrolling = 'no';
    iframe.title = 'Advertisement';
    iframe.setAttribute('allow', 'autoplay');
    iframe.setAttribute('loading', 'eager');

    // Attach iframe to DOM first so contentWindow & document exist
    container.appendChild(iframe);

    const htmlContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <script>
    window.onerror = function() { return true; };
    window.addEventListener('error', function(e) { e.preventDefault(); }, true);
  </script>
  <style>
    html, body {
      margin: 0;
      padding: 0;
      overflow: hidden;
      background: transparent;
      display: flex;
      justify-content: center;
      align-items: center;
      width: 100%;
      height: 60px;
    }
  </style>
</head>
<body>
  ${banner.script}
</body>
</html>`;

    try {
      const doc = iframe.contentWindow?.document || iframe.contentDocument;
      if (doc) {
        doc.open();
        doc.write(htmlContent);
        doc.close();
      } else {
        iframe.srcdoc = htmlContent;
      }
    } catch {
      iframe.srcdoc = htmlContent;
    }
  }, [banner?.script, banner?.status, isEnabled]);

  if (!isEnabled) return null;

  return (
    <div className="w-full overflow-hidden flex justify-center my-1">
      <div
        ref={containerRef}
        className="w-full max-w-[468px] min-h-[60px] overflow-hidden rounded flex justify-center items-center bg-transparent"
      />
    </div>
  );
});
