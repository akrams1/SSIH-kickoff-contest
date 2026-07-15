'use client';

import { useEffect, useRef } from 'react';

// Verified with zxing-cpp (the decoder family phones use): this config decodes
// reliably down to ~90px and through heavy blur. Two things carry that:
//   - errorCorrectionLevel 'H' (30% recovery) — mandatory, the logo destroys data
//   - hideBackgroundDots — the logo art has transparent gaps; without this,
//     QR dots show through them and muddy the finder pattern.
// Don't raise imageSize past ~0.4 without re-testing a real scan.
const qrOptions = (data, size) => ({
  width: size,
  height: size,
  type: 'canvas',
  data,
  image: '/logo-mark.png',
  margin: 8,
  qrOptions: { errorCorrectionLevel: 'H' },
  dotsOptions: { type: 'rounded', color: '#234636' },
  cornersSquareOptions: { type: 'extra-rounded', color: '#234636' },
  cornersDotOptions: { type: 'dot', color: '#234636' },
  backgroundOptions: { color: '#ffffff' },
  imageOptions: {
    hideBackgroundDots: true,
    imageSize: 0.4,
    margin: 6,
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
