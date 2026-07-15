'use client';

import { useState, useRef, useEffect } from 'react';
import { db, auth } from '@/lib/firebase';
import {
  collection, getDocs, writeBatch, doc, getDoc, setDoc,
} from 'firebase/firestore';
import { EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { RotateCcw, Loader2, AlertCircle, CheckCircle, ShieldAlert } from 'lucide-react';

export default function SettingsTab() {
  const [passkey, setPasskey] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [msg, setMsg] = useState(null);
  const msgTimer = useRef(null);

  useEffect(() => () => { if (msgTimer.current) clearTimeout(msgTimer.current); }, []);

  const say = (kind, text) => {
    setMsg({ kind, text });
    if (msgTimer.current) clearTimeout(msgTimer.current);
    msgTimer.current = setTimeout(() => setMsg(null), 4000);
  };

  const resetVotes = async () => {
    if (!passkey.trim()) return say('err', 'Enter the passkey first.');

    setBusy(true);
    try {
      const user = auth.currentUser;
      if (!user?.email) {
        say('err', 'Session expired. Sign out and back in.');
        return;
      }

      // Verify the passkey against Firebase rather than comparing a string in
      // JS. A client-side check is theatre — anyone can skip it from devtools.
      // This makes the server confirm the credential before anything is wiped.
      const cred = EmailAuthProvider.credential(user.email, passkey.trim());
      await reauthenticateWithCredential(user, cred);

      // Zero every tally in one atomic batch: no half-reset state.
      const snap = await getDocs(collection(db, 'contestants'));
      const batch = writeBatch(db);
      snap.docs.forEach((d) => batch.update(d.ref, { votes: 0 }));
      await batch.commit();

      // Bump the round so every phone's local "already voted" lock is released.
      // Without this, the counters read zero but nobody could vote again.
      const cfgRef = doc(db, 'config', 'event');
      const cfg = await getDoc(cfgRef);
      const round = (cfg.exists() && typeof cfg.data().round === 'number' ? cfg.data().round : 1) + 1;
      await setDoc(cfgRef, { round }, { merge: true });

      setPasskey('');
      setConfirming(false);
      say('ok', `Reset ${snap.size} ${snap.size === 1 ? 'entry' : 'entries'} to zero. Everyone can vote again.`);
    } catch (err) {
      console.error('Reset error:', err);
      if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        say('err', 'Wrong passkey. Nothing was changed.');
      } else if (err.code === 'auth/too-many-requests') {
        say('err', 'Too many attempts. Wait a moment and try again.');
      } else {
        say('err', 'Reset failed. Nothing was changed.');
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
        <div className="flex items-start gap-3 mb-4">
          <div className="p-2 bg-red-50 rounded-lg flex-shrink-0">
            <ShieldAlert className="w-5 h-5 text-red-500" />
          </div>
          <div>
            <h3 className="font-bold text-slate-700">Reset all votes</h3>
            <p className="text-sm text-slate-500 mt-0.5">
              Sets every entry back to zero and lets everyone vote again. The entries and
              their photos are kept. This cannot be undone.
            </p>
          </div>
        </div>

        {!confirming ? (
          <button
            onClick={() => setConfirming(true)}
            className="w-full px-4 py-2.5 bg-white border border-red-200 text-red-600 hover:bg-red-50 rounded-xl font-semibold flex items-center justify-center gap-2 transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            Reset votes
          </button>
        ) : (
          <div className="space-y-3 bg-red-50 border border-red-200 rounded-xl p-4">
            <p className="text-sm font-semibold text-red-700">
              Confirm with the admin passkey
            </p>
            <input
              type="password"
              value={passkey}
              onChange={(e) => setPasskey(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') resetVotes(); }}
              autoFocus
              autoComplete="current-password"
              className="w-full px-3 py-2.5 bg-white border border-red-200 rounded-lg text-slate-900 focus:ring-2 focus:ring-red-100 focus:border-red-400 outline-none transition-all text-sm"
            />
            <div className="flex gap-2">
              <button
                onClick={() => { setConfirming(false); setPasskey(''); }}
                disabled={busy}
                className="flex-1 px-4 py-2.5 bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-lg font-semibold text-sm transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={resetVotes}
                disabled={busy || !passkey.trim()}
                className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 disabled:bg-slate-300 text-white rounded-lg font-semibold text-sm flex items-center justify-center gap-2 transition-colors"
              >
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
                Reset now
              </button>
            </div>
          </div>
        )}
      </div>

      {msg && (
        <div
          className={`p-3 rounded-xl flex items-start gap-2 text-sm font-medium ${
            msg.kind === 'ok'
              ? 'bg-green-50 text-green-700 border border-green-200'
              : 'bg-red-50 text-red-600 border border-red-200'
          }`}
        >
          {msg.kind === 'ok'
            ? <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            : <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />}
          {msg.text}
        </div>
      )}
    </div>
  );
}
