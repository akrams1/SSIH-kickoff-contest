import { CLOUDINARY_CLOUD_NAME, CLOUDINARY_UPLOAD_PRESET } from '@/lib/config';

// Shrink a photo before it ever leaves the phone.
//
// This matters more than it looks: last year's report recorded that the dorm
// Wi-Fi in the auditorium was the thing that broke the contest. A modern phone
// photo is 4–8 MB; on a congested network that is a 30s upload that often fails.
// Resized to 1600px JPEG it is ~300–500 KB, which goes through on a bad link.
export function compressImage(file, maxDim = 1600, quality = 0.8) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read the file'));
    reader.onload = () => {
      const img = new window.Image();
      img.onerror = () => reject(new Error('Could not decode the image'));
      img.onload = () => {
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        canvas.toBlob(
          (blob) => (blob ? resolve(blob) : reject(new Error('Could not compress'))),
          'image/jpeg',
          quality
        );
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

// Upload one image to Cloudinary via the unsigned preset.
export async function uploadToCloudinary(fileOrBlob) {
  const form = new FormData();
  form.append('file', fileOrBlob);
  form.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
    { method: 'POST', body: form }
  );
  if (!res.ok) throw new Error('Upload failed');

  const data = await res.json();
  return { url: data.secure_url, publicId: data.public_id || '' };
}

// Fetch a remote image back as a data URL, for embedding into the PDF.
// Cloudinary serves permissive CORS headers, so this works without tainting.
export async function urlToDataUrl(url) {
  const res = await fetch(url, { mode: 'cors' });
  if (!res.ok) throw new Error('Could not fetch image');
  const blob = await res.blob();
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not encode image'));
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(blob);
  });
}
