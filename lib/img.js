// Insert Cloudinary on-the-fly transforms into a stored delivery URL so we
// serve right-sized, auto-compressed images instead of raw 10 MB phone photos.
// Non-Cloudinary URLs (or already-transformed ones) are returned untouched.
export function cldThumb(url, width) {
  if (!url || typeof url !== 'string') return url;
  const marker = '/upload/';
  const i = url.indexOf(marker);
  if (i === -1) return url;
  const after = url.slice(i + marker.length);
  // Already has a transform segment -> don't double-apply.
  if (/^[a-z]_[^/]+\//.test(after)) return url;
  return `${url.slice(0, i + marker.length)}f_auto,q_auto,w_${width}/${after}`;
}
