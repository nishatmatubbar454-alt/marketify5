import { ref as rtdbRef, set as rtdbSet, onValue as rtdbOnValue } from 'firebase/database';
import { realtimeDb } from '../lib/firebase';
import { useEffect, useState } from 'react';

export const DEFAULT_DOWNLOAD_LINK = 'https://ads-network.markafi189.workers.dev/';
const STORAGE_KEY = 'mk-download-direct-link';

export function getCachedDownloadLink(): string {
  if (typeof localStorage === 'undefined') return DEFAULT_DOWNLOAD_LINK;
  return localStorage.getItem(STORAGE_KEY) || DEFAULT_DOWNLOAD_LINK;
}

export async function setDownloadDirectLink(url: string): Promise<void> {
  const cleanUrl = url.trim() || DEFAULT_DOWNLOAD_LINK;
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_KEY, cleanUrl);
    } catch {}
  }
  try {
    const linkRef = rtdbRef(realtimeDb, 'settings/downloadDirectLink');
    await rtdbSet(linkRef, cleanUrl);
  } catch (err) {
    console.warn('Failed to save download link to Firebase:', err);
  }
}

export function useDownloadDirectLink() {
  const [downloadLink, setDownloadLink] = useState<string>(getCachedDownloadLink);

  useEffect(() => {
    try {
      const linkRef = rtdbRef(realtimeDb, 'settings/downloadDirectLink');
      const unsubscribe = rtdbOnValue(linkRef, (snapshot) => {
        const val = snapshot.val();
        if (typeof val === 'string' && val.trim()) {
          setDownloadLink(val.trim());
          try {
            localStorage.setItem(STORAGE_KEY, val.trim());
          } catch {}
        }
      });
      return () => unsubscribe();
    } catch {}
  }, []);

  return { downloadLink, setLink: setDownloadDirectLink };
}
