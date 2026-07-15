'use client';

import { useEffect, useRef } from 'react';
import { qrOptions } from '@/lib/qr';

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
