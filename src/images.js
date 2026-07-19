// Note images: pasted/dropped screenshots stored as compressed data URLs in the
// vault (localStorage), referenced from markdown as ![caption](img:<id>).

export const newImageId = () => 'img' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);

/** Downscale + recompress an image file so screenshots don't blow up the vault.
    WebP where the browser supports encoding it, JPEG otherwise. */
export async function fileToCompressedDataUrl(file, maxDim = 1600) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error('That file could not be read as an image.'));
      i.src = url;
    });
    const scale = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.max(1, Math.round(img.naturalWidth * scale));
    const h = Math.max(1, Math.round(img.naturalHeight * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff'; // flatten transparency for lossy formats
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    let out = canvas.toDataURL('image/webp', 0.85);
    if (!out.startsWith('data:image/webp')) out = canvas.toDataURL('image/jpeg', 0.87);
    return out;
  } finally {
    URL.revokeObjectURL(url);
  }
}
