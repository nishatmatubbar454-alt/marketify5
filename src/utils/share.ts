export async function shareVideo(id: string, title: string): Promise<string> {
  const url = `${window.location.origin}/video/${id}`;
  const nav = navigator as Navigator & { share?: (data: ShareData) => Promise<void> };
  if (nav.share) {
    try {
      await nav.share({ title, url });
      return 'Shared';
    } catch {
      return '';
    }
  }
  try {
    await navigator.clipboard.writeText(url);
    return 'Link copied to clipboard';
  } catch {
    return url;
  }
}
