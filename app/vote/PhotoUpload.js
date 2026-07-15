'use client';

import { useState, useRef, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { compressImage, uploadToCloudinary } from '@/lib/upload';
import { Camera, Loader2, Check, AlertCircle } from 'lucide-react';

// Soft cap per device. This is NOT security — anyone can clear localStorage and
// upload more. Real protection lives in firestore.rules: uploads are only
// allowed while the event is open, and every field is shape-checked. This just
// stops honest accidents like selecting an entire camera roll.
const SENT_KEY = 'photosSent_kickoff26';
const MAX_PER_DEVICE = 20;
const MAX_PER_BATCH = 10;

export default function PhotoUpload({ open }) {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(0);
  const [progress, setProgress] = useState(null);
  const [msg, setMsg] = useState(null);
  const timer = useRef(null);

  useEffect(() => {
    setDone(Number(localStorage.getItem(SENT_KEY) || 0));
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, []);

  const say = (kind, text, ms = 3200) => {
    setMsg({ kind, text });
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setMsg(null), ms);
  };

  const onPick = async (e) => {
    const files = Array.from(e.target.files || []).filter((f) => f.type.startsWith('image/'));
    e.target.value = '';
    if (!files.length) return;

    if (done >= MAX_PER_DEVICE) {
      say('err', "That's plenty of photos from this phone. Thank you!");
      return;
    }

    const batch = files.slice(0, MAX_PER_BATCH);
    setBusy(true);
    let ok = 0;

    for (let i = 0; i < batch.length; i++) {
      setProgress(`${i + 1} of ${batch.length}`);
      try {
        const blob = await compressImage(batch[i]);
        const { url, publicId } = await uploadToCloudinary(blob);
        await addDoc(collection(db, 'photos'), {
          url,
          publicId,
          createdAt: serverTimestamp(),
        });
        ok++;
      } catch (err) {
        console.error('Photo upload failed:', err);
      }
    }

    const total = done + ok;
    setDone(total);
    localStorage.setItem(SENT_KEY, String(total));
    setBusy(false);
    setProgress(null);

    if (ok === batch.length) say('ok', `Thanks! ${ok} photo${ok > 1 ? 's' : ''} sent.`);
    else if (ok > 0) say('ok', `${ok} of ${batch.length} sent. The rest failed — try again.`);
    else say('err', 'Upload failed. Check your connection and try again.');
  };

  if (!open) return null;

  return (
    <div className="mt-10 bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex-1">
          <h2 className="font-semibold text-slate-700 flex items-center gap-2">
            <Camera className="w-4 h-4 text-green-600" />
            Share your photos
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Took a good one tonight? Add it and it may end up in the event report.
          </p>
        </div>

        <div className="relative flex-shrink-0">
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={onPick}
            disabled={busy}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10 disabled:cursor-not-allowed"
            aria-label="Choose photos to upload"
          />
          <div
            className={`px-4 py-2.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-colors ${
              busy ? 'bg-slate-100 text-slate-500' : 'bg-green-600 text-white hover:bg-green-700'
            }`}
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
            {busy ? `Sending ${progress}` : 'Add photos'}
          </div>
        </div>
      </div>

      {(msg || done > 0) && (
        <div className="mt-3">
          {msg ? (
            <p
              className={`text-sm font-medium flex items-center gap-1.5 ${
                msg.kind === 'ok' ? 'text-green-700' : 'text-red-600'
              }`}
            >
              {msg.kind === 'ok' ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
              {msg.text}
            </p>
          ) : (
            <p className="text-xs text-slate-500">
              {done} photo{done > 1 ? 's' : ''} sent from this phone.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
