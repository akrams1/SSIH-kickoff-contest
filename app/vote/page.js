'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { db } from '@/lib/firebase';
import {
  collection, query, orderBy, onSnapshot,
  doc, updateDoc, increment
} from 'firebase/firestore';
import { cldThumb } from '@/lib/img';
import Image from 'next/image';
import Link from 'next/link';
import { Heart, ArrowLeft, Loader2, Shirt, Check, Lock } from 'lucide-react';

// Bump this key if you redeploy on a domain that ran a previous event,
// so returning voters aren't blocked by an old record.
const VOTED_KEY = 'votedFor_kickoff26';

// SINGLE-CHOICE voting: one vote per person, final.
// To switch to APPROVAL (vote for many), see the note on handleVote below.

// Stable per-session shuffle: unbiased order that does NOT reshuffle on every
// snapshot (which would reorder cards mid-vote). Seeded by a random ref.
function hashKey(id, seed) {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h ^ seed) >>> 0;
}

export default function VotePage() {
  const [contestants, setContestants] = useState([]);
  const [votedFor, setVotedFor] = useState(null); // single id, or null
  const [votingOpen, setVotingOpen] = useState(true);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const seed = useRef(Math.floor(Math.random() * 2 ** 31));
  const toastTimer = useRef(null);

  const showToast = (text) => {
    setToast(text);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2600);
  };

  const totalVotes = contestants.reduce((sum, c) => sum + (c.votes || 0), 0);

  // Shuffle once per session; recompute only when the set of ids changes.
  const ordered = useMemo(() => {
    return [...contestants].sort(
      (a, b) => hashKey(a.id, seed.current) - hashKey(b.id, seed.current)
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contestants.map((c) => c.id).join(',')]);

  useEffect(() => {
    const saved = localStorage.getItem(VOTED_KEY);
    if (saved) setVotedFor(saved);

    const q = query(collection(db, 'contestants'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      setContestants(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });

    // Live voting-open flag. Fail-open: missing doc or open !== false => open.
    const unsubCfg = onSnapshot(doc(db, 'config', 'event'), (snap) => {
      setVotingOpen(!snap.exists() || snap.data().open !== false);
    });

    return () => {
      unsub();
      unsubCfg();
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

  const handleVote = async (contestantId) => {
    if (!votingOpen) return showToast('Voting has closed.');
    // SINGLE-CHOICE guard. For APPROVAL voting, change this line to:
    //   if (votedFor.has(contestantId)) return;   (and make votedFor a Set)
    if (votedFor) return showToast('You already voted — one vote each.');

    // Optimistic lock BEFORE the network call so a double-tap can't double-fire.
    setVotedFor(contestantId);
    localStorage.setItem(VOTED_KEY, contestantId);

    try {
      await updateDoc(doc(db, 'contestants', contestantId), { votes: increment(1) });
    } catch (err) {
      console.error('Vote error:', err);
      setVotedFor(null);
      localStorage.removeItem(VOTED_KEY);
      showToast('Vote failed — try again.');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-green-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-12">
      <div className="max-w-7xl mx-auto">

        <div className="flex flex-col md:flex-row md:items-center justify-between mb-8">
          <div>
            <Link href="/" className="inline-flex items-center text-slate-500 hover:text-slate-600 mb-4 transition-colors font-medium text-sm">
              <ArrowLeft className="w-4 h-4 mr-2" /> Home
            </Link>
            <h1 className="text-3xl md:text-4xl font-bold text-green-700 tracking-tight">Costume Gallery</h1>
            <p className="text-slate-500 mt-1">
              {votingOpen ? 'Pick your favorite — one vote each.' : 'Voting has closed.'}
            </p>
          </div>

          <div className="mt-4 md:mt-0 px-4 py-2 bg-white rounded-full border border-slate-200 text-slate-600 text-sm font-medium flex items-center gap-2 shadow-sm">
            <Heart className="w-4 h-4 text-green-600 fill-green-600" />
            <span>{totalVotes} total votes</span>
          </div>
        </div>

        {!votingOpen && (
          <div className="mb-8 inline-flex items-center gap-2 bg-red-50 border border-red-200 text-red-600 rounded-full px-4 py-2 font-semibold">
            <Lock className="w-4 h-4 flex-shrink-0" />
            Voting has closed.
          </div>
        )}

        {ordered.length === 0 ? (
          <div className="text-center py-20 bg-white/50 rounded-3xl border border-dashed border-slate-200">
            <div className="inline-block p-4 bg-slate-50 rounded-full mb-4">
              <Shirt className="w-8 h-8 text-slate-400" />
            </div>
            <p className="text-xl font-medium text-slate-600">No costumes yet</p>
            <p className="text-slate-500 text-sm mt-1">Check back once entries are added!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {ordered.map((contestant, idx) => {
              const isMine = votedFor === contestant.id;
              const lockedOut = (!!votedFor && !isMine) || !votingOpen;
              return (
                <div
                  key={contestant.id}
                  style={{ animationDelay: `${Math.min(idx, 8) * 60}ms` }}
                  className={`fade-up group bg-white rounded-2xl overflow-hidden shadow-sm border transition-all duration-300 ${
                    isMine ? 'border-green-400 ring-2 ring-green-100' : 'border-slate-100 hover:shadow-xl hover:-translate-y-1'
                  }`}
                >
                  <div className="relative aspect-[4/5] bg-slate-100">
                    <Image
                      src={cldThumb(contestant.photoURL, 800)}
                      alt={contestant.name}
                      fill
                      sizes="(max-width: 768px) 100vw, 33vw"
                      className={`object-cover transition-opacity ${lockedOut && !isMine ? 'opacity-80' : ''}`}
                      unoptimized
                    />
                    {isMine && (
                      <div className="absolute top-3 right-3 bg-green-600 text-white text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1 shadow">
                        <Check className="w-3 h-3" /> Your vote
                      </div>
                    )}
                  </div>

                  <div className="p-5 flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-slate-700 truncate pr-4">
                      {contestant.name}
                    </h3>

                    <button
                      onClick={() => handleVote(contestant.id)}
                      disabled={lockedOut || isMine}
                      className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-all ${
                        isMine
                          ? 'bg-green-50 text-green-600 cursor-default'
                          : lockedOut
                          ? 'bg-slate-50 text-slate-400 cursor-not-allowed'
                          : 'bg-slate-50 text-slate-600 hover:bg-green-600 hover:text-white shadow-sm hover:shadow-md'
                      }`}
                    >
                      <Heart className={`w-4 h-4 ${isMine ? 'fill-green-600' : ''}`} />
                      {isMine ? 'Voted' : 'Vote'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white text-sm font-medium px-5 py-3 rounded-full shadow-xl animate-in fade-in slide-in-from-bottom-2">
          {toast}
        </div>
      )}
    </div>
  );
}
