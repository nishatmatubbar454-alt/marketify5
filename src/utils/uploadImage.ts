const DEFAULT_IMGBB_KEY = '9ac3047373b9c5ac694369893d6dfaaf';

export function getImgBBKey(): string {
  try {
    const saved = localStorage.getItem('mk-imgbb-key');
    if (saved) return saved.trim();
  } catch {}
  return DEFAULT_IMGBB_KEY;
}

export function setImgBBKey(key: string) {
  try {
    localStorage.setItem('mk-imgbb-key', key.trim());
  } catch {}
}

export async function uploadThumbnail(file: File): Promise<string> {
  const apiKey = getImgBBKey();
  try {
    const formData = new FormData();
    formData.append('image', file);
    const res = await fetch(`https://api.imgbb.com/1/upload?key=${apiKey}`, {
      method: 'POST',
      body: formData
    });
    const json = await res.json();
    if (json && json.success && json.data && json.data.url) {
      return json.data.url;
    }
  } catch (err) {
    console.warn('ImgBB API upload fallback to local:', err);
  }

  // Robust fallback: read as data URL reliably on first try
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      if (!dataUrl) {
        reject(new Error('Failed to read image data.'));
        return;
      }
      
      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          const MAX_DIM = 1000;
          if (width > MAX_DIM || height > MAX_DIM) {
            if (width > height) {
              height = Math.round((height * MAX_DIM) / width);
              width = MAX_DIM;
            } else {
              width = Math.round((width * MAX_DIM) / height);
              height = MAX_DIM;
            }
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(dataUrl);
            return;
          }
          ctx.drawImage(img, 0, 0, width, height);
          const compressed = canvas.toDataURL('image/jpeg', 0.85);
          resolve(compressed);
        } catch {
          resolve(dataUrl);
        }
      };
      img.onerror = () => {
        resolve(dataUrl);
      };
      img.src = dataUrl;
    };
    reader.onerror = () => reject(new Error('Image reading error.'));
    reader.readAsDataURL(file);
  });
}
