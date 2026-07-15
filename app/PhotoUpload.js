'use client';

import { useState, useRef, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { compressImage, uploadToCloudinary } from '@/lib/upload';
import { Camera, Loader2, Check, AlertCircle } from 'lucide-react';

// Soft cap per device. This is NOT security — anyone can clear localStorage and
// upload more. Real enforcement lives in firestore.rules, which gate uploads on
// the event being open and shape-check every field. This just keeps one person
// from dumping a camera roll.
const SENT_KEY = 'photosSent_kickoff26';
const MAX_PER_DEVICE = 3;

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

  const say = (kind, text, ms = 5000) => {
    setMsg({ kind, text });
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setMsg(null), ms);
  };

  const left = Math.max(0, MAX_PER_DEVICE - done);

  const onPick = async (e) => {
    const files = Array.from(e.target.files || []).filter((f) => f.type.startsWith('image/'));
    e.target.value = '';
    if (!files.length) return;

    if (left <= 0) {
      say('err', `Limit is ${MAX_PER_DEVICE} photos per person.`);
      return;
    }

    const batch = files.slice(0, left);
    const skipped = files.length - batch.length;

    setBusy(true);
    let ok = 0;
    let lastErr = null;

    for (let i = 0; i < batch.length; i++) {
      setProgress(`${i + 1}/${batch.length}`);
      try {
        const blob = await compressImage(batch[i]);
        const { url, publicId } = await uploadToCloudinary(blob);
        await addDoc(collection(db, 'photos'), { url, publicId, createdAt: serverTimestamp() });
        ok++;
      } catch (err) {
        console.error('Photo upload failed:', err);
        lastErr = err;
      }
    }

    const total = done + ok;
    setDone(total);
    localStorage.setItem(SENT_KEY, String(total));
    setBusy(false);
    setProgress(null);

    if (ok > 0 && ok === batch.length) {
      say('ok', skipped > 0
        ? `${ok} sent. Limit is ${MAX_PER_DEVICE} per person.`
        : `Thanks! ${ok} photo${ok > 1 ? 's' : ''} sent.`);
    } else if (ok > 0) {
      say('err', `Only ${ok} of ${batch.length} went through. Try the rest again.`);
    } else {
      // Say what actually happened rather than blaming the network for everything.
      const code = lastErr?.code || '';
      if (code === 'permission-denied') {
        say('err', 'Uploads are closed right now.');
      } else if (lastErr?.message === 'Upload failed') {
        say('err', 'Could not reach the photo server. Check your connection.');
      } else {
        say('err', 'Upload failed. Please try again.');
      }
    }
  };

  if (!open) return null;

  return (
    <div className="w-full flex flex-col items-center">
      <div className="relative">
        <input
          type="file"
          accept="image/*"
          multiple
          onChange={onPick}
          disabled={busy || left <= 0}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10 disabled:cursor-not-allowed"
          aria-label="Choose photos to upload"
        />
        <div
          className={`px-5 py-2.5 rounded-xl border font-semibold text-sm flex items-center justify-center gap-2 transition-colors select-none ${
            busy || left <= 0
              ? 'bg-slate-50 border-slate-200 text-slate-500'
              : 'bg-white border-green-300 text-green-700 hover:bg-green-50'
          }`}
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
          {busy ? `Sending ${progress}` : left <= 0 ? 'Photos received' : 'Add your photos'}
        </div>
      </div>

      <p className="mt-2 text-xs text-slate-500 text-center min-h-[1rem]">
        {msg ? (
          <span className={`font-medium inline-flex items-center gap-1 ${msg.kind === 'ok' ? 'text-green-700' : 'text-red-600'}`}>
            {msg.kind === 'ok' ? <Check className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
            {msg.text}
          </span>
        ) : (
          `Share up to ${MAX_PER_DEVICE} photos of the night`
        )}
      </p>
    </div>
  );
}
