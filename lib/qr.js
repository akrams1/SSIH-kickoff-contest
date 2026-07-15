// Single source of truth for the styled QR, used by both the on-screen QR and
// the PDF report. Keeping one config means the report can never drift from what
// people actually scan (e.g. silently losing the football logo).
//
// Verified with zxing-cpp: decodes at 100px, 45deg rotation, blur r=3, low
// contrast, camera noise and perspective tilt.
//   - errorCorrectionLevel 'H' (30% recovery) — mandatory, the logo destroys data
//   - hideBackgroundDots — the logo art has transparent gaps; without this, QR
//     dots show through the ball's panels
//   - imageSize 0.55 is the ceiling: the library quantises the logo to whole
//     modules and clamps it to the error-correction budget, so 0.6 renders the
//     same. Re-test a real scan if you change these.
export const qrOptions = (data, size) => ({
  width: size,
  height: size,
  type: 'canvas',
  data,
  image: '/logo-mark.png',
  margin: 8,
  qrOptions: { errorCorrectionLevel: 'H' },
  dotsOptions: { type: 'rounded', color: '#1b372a' },
  cornersSquareOptions: { type: 'extra-rounded', color: '#1b372a' },
  cornersDotOptions: { type: 'dot', color: '#1b372a' },
  backgroundOptions: { color: '#ffffff' },
  imageOptions: {
    hideBackgroundDots: true,
    imageSize: 0.55,
    margin: 4,
    crossOrigin: 'anonymous',
  },
});

// Render a QR offscreen and return a PNG data URL. Used by the report, which
// has no QR on screen to copy from.
export async function generateQrDataUrl(data, size = 600) {
  const mod = await import('qr-code-styling');
  const QRCodeStyling = mod.default || mod;
  const qr = new QRCodeStyling(qrOptions(data, size));

  const blob = await qr.getRawData('png');
  if (!blob) throw new Error('QR render returned nothing');

  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('QR encode failed'));
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(blob);
  });
}
