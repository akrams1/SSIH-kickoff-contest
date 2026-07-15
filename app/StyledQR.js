'use client';

import { useEffect, useRef } from 'react';

// Verified with zxing-cpp (the decoder family phones use). At these values the
// code still decodes at 100px, 45deg rotation, blur r=3, low contrast, camera
// noise and perspective tilt.
//   - errorCorrectionLevel 'H' (30% recovery) — mandatory, the logo destroys data
//   - hideBackgroundDots — the logo art has transparent gaps; without this,
//     QR dots show through the ball's panels and muddy it.
//   - imageSize 0.55 is the practical ceiling: the library quantises the logo to
//     whole modules and clamps it to the error-correction budget, so 0.6 renders
//     identically to 0.55. Raising it further does nothing.
// Re-test a real scan if you change the logo art or these numbers.
const qrOptions = (data, size) => ({
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

export default function StyledQR({ data, size = 400, className = '' }) {
  const holder = useRef(null);
  const qr = useRef(null);

  useEffect(() => {
    if (!data) return;
    let cancelled = false;

    (async () => {
      // Client-only: the library needs canvas/DOM, so it can't be imported at
      // module scope in a server-rendered file.
      const mod = await import('qr-code-styling');
      const QRCodeStyling = mod.default || mod;
      if (cancelled || !holder.current) return;

      if (!qr.current) {
        qr.current = new QRCodeStyling(qrOptions(data, size));
        holder.current.innerHTML = '';
        qr.current.append(holder.current);
      } else {
        qr.current.update(qrOptions(data, size));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [data, size]);

  return (
    <div
      ref={holder}
      className={className}
      role="img"
      aria-label="QR code — scan to open the voting page"
    />
  );
}
