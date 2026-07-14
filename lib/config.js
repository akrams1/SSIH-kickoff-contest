// Cloudinary target. Reads env first (NEXT_PUBLIC_* so it reaches the browser),
// falls back to the shared account so the app still runs out of the box.
// For a PUBLIC repo, delete the fallbacks and rely on .env.local only.
export const CLOUDINARY_CLOUD_NAME =
  process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || 'dermlcur4';
export const CLOUDINARY_UPLOAD_PRESET =
  process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET || 'pj_party_upload';
