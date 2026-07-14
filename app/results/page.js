'use client';

import { useState, useEffect, useRef } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import { Trophy, Loader2 } from 'lucide-react';
import { Bebas_Neue } from 'next/font/google';
import { rankSort } from '@/lib/rank';
import { cldThumb } from '@/lib/img';

const bebas = Bebas_Neue({ subsets: ['latin'], weight: '400' });

// Faint chalk pitch markings — the one ambient layer. Kept low-contrast so it
// reads as texture, never decoration competing with the standings.
function PitchLines() {
  return (
    <svg className="absolute inset-0 w-full h-full pointer-events-none" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <g fill="none" stroke="#356f50" strokeOpacity="0.08" strokeWidth="2">
        <line x1="0" y1="50%" x2="100%" y2="50%" />
        <circle cx="50%" cy="50%" r="120" />
        <circle cx="50%" cy="50%" r="4" fill="#356f50" fillOpacity="0.12" stroke="none" />
      </g>
    </svg>
  );
}

// One player's block on the podium. `size` drives the winner emphasis.
function PodiumPlayer({ player, rank, size }) {
  const winner = rank === 1;
  const dims = size === 'lg' ? 'w-32 h-32 md:w-40 md:h-40' : 'w-20 h-20 md:w-24 md:h-24';
  return (
    <div className="flex flex-col items-center text-center">
      {winner && <Trophy className="w-7 h-7 text-yellow-500 mb-3" strokeWidth={1.75} />}
      <div className="relative">
        <div className={`${dims} rounded-full overflow-hidden bg-slate-100 ring-2 ${winner ? 'ring-yellow-400' : 'ring-slate-200'}`}>
          <img src={cldThumb(player.photoURL, winner ? 400 : 300)} alt={player.name} className="w-full h-full object-cover" />
        </div>
        {/* Kit number plate */}
        <div className={`absolute -bottom-1 -right-1 ${size === 'lg' ? 'w-10 h-10' : 'w-8 h-8'} rounded-full flex items-center justify-center ring-2 ring-slate-50 ${winner ? 'bg-yellow-400 text-slate-900' : 'bg-slate-900 text-white'}`}>
          <span className={`${bebas.className} ${size === 'lg' ? 'text-xl' : 'text-base'} leading-none pt-0.5`}>{rank}</span>
        </div>
      </div>
      <p className={`mt-4 font-semibold text-slate-800 ${size === 'lg' ? 'text-lg' : 'text-sm'} max-w-[8rem] truncate`}>{player.name}</p>
      <p className={`${bebas.className} ${size === 'lg' ? 'text-3xl' : 'text-2xl'} text-slate-900 leading-none mt-1`}>{player.votes}</p>
      <p className="text-[10px] uppercase tracking-widest text-slate-400 mt-0.5">votes</p>
    </div>
  );
}

export default function ResultsPage() {
  const [contestants, setContestants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState(0); // 0 = kickoff; reveals bottom-up
  const fired = useRef(false);

  useEffect(() => {
    const q = query(collection(db, 'contestants'), orderBy('votes', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      data.sort(rankSort);
      setContestants(data);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const fireConfetti = () => {
    if (fired.current) return;
    fired.current = true;
    const end = Date.now() + 2200;
    const colors = ['#55ac82', '#eab308', '#ffffff'];
    const frame = () => {
      if (Date.now() > end) return;
      confetti({ particleCount: 24, angle: 60, spread: 55, origin: { x: 0 }, colors, ticks: 70 });
      confetti({ particleCount: 24, angle: 120, spread: 55, origin: { x: 1 }, colors, ticks: 70 });
      requestAnimationFrame(frame);
    };
    frame();
  };

  const podiumLen = Math.min(3, contestants.length);
  const advance = () => setStep((s) => Math.min(s + 1, podiumLen));
  const shown = (r) => step >= podiumLen - r; // r: 0 = winner

  useEffect(() => {
    if (podiumLen > 0 && step >= podiumLen) fireConfetti();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, podiumLen]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-7 h-7 text-green-700 animate-spin" />
      </div>
    );
  }

  if (contestants.length === 0) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center text-center px-6 relative overflow-hidden">
        <PitchLines />
        <p className="relative text-xs uppercase tracking-[0.25em] text-slate-400 mb-3">SSIH Kick Off &rsquo;26</p>
        <h1 className={`${bebas.className} relative text-6xl text-slate-900`}>No entries yet</h1>
        <p className="relative text-slate-500 mt-2">Add costumes in the admin panel to kick things off.</p>
      </div>
    );
  }

  const [first, second, third, ...others] = contestants;
  const revealedAll = step >= podiumLen;
  const topTie = first && second && (first.votes || 0) === (second.votes || 0);
  const nextRank = podiumLen - (step + 1);
  const nextLabel = nextRank === 0 ? 'Reveal the winner' : nextRank === 1 ? 'Reveal 2nd' : 'Reveal 3rd';

  return (
    <div className="min-h-screen bg-slate-50 relative overflow-hidden">
      <PitchLines />

      <div className="relative max-w-3xl mx-auto px-6 py-16">

        {/* Header — scoreboard masthead */}
        <div className="fade-up text-center mb-14">
          <p className="text-xs uppercase tracking-[0.25em] text-green-700 font-semibold mb-2">
            SSIH Kick Off &rsquo;26 &middot; Costume Contest
          </p>
          <h1 className={`${bebas.className} text-7xl md:text-8xl text-slate-900 leading-none`}>Full Time</h1>
          <div className="flex items-center justify-center gap-3 mt-3">
            <span className="h-px w-8 bg-slate-300" />
            <p className="text-sm uppercase tracking-widest text-slate-500">Final Standings</p>
            <span className="h-px w-8 bg-slate-300" />
          </div>
        </div>

        {/* Kickoff prompt */}
        {step === 0 && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center py-10">
            <button
              onClick={advance}
              className="group flex flex-col items-center gap-4"
            >
              <span className="w-20 h-20 rounded-full border-2 border-green-700/30 flex items-center justify-center group-hover:border-green-700 group-hover:scale-105 transition-all">
                <span className={`${bebas.className} text-2xl text-green-700`}>GO</span>
              </span>
              <span className="text-sm uppercase tracking-widest text-slate-500 group-hover:text-slate-800 transition-colors">Kick off</span>
            </button>
          </motion.div>
        )}

        {/* Podium — no pedestals; emphasis by scale, aligned to a chalk baseline */}
        {step >= 1 && (
          <div className="mb-4">
            <div className="flex items-end justify-center gap-8 md:gap-14 pb-8 border-b border-slate-200">
              <AnimatePresence>
                {second && shown(1) && (
                  <motion.div key="2" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}>
                    <PodiumPlayer player={second} rank={2} size="sm" />
                  </motion.div>
                )}
                {first && shown(0) && (
                  <motion.div key="1" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ type: 'spring', bounce: 0.35 }}>
                    <PodiumPlayer player={first} rank={1} size="lg" />
                  </motion.div>
                )}
                {third && shown(2) && (
                  <motion.div key="3" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}>
                    <PodiumPlayer player={third} rank={3} size="sm" />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            {topTie && revealedAll && (
              <p className="text-center text-xs text-slate-400 mt-3">Level on votes at the top — separated by earliest entry.</p>
            )}
          </div>
        )}

        {/* Advance */}
        {step > 0 && !revealedAll && (
          <div className="flex justify-center mt-8">
            <button
              onClick={advance}
              className="px-7 py-2.5 rounded-full bg-slate-900 text-white text-xs uppercase tracking-widest font-semibold hover:bg-slate-800 transition-colors active:scale-95"
            >
              {nextLabel}
            </button>
          </div>
        )}

        {/* League table — 4th onward */}
        {revealedAll && others.length > 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-12">
            <p className="text-xs uppercase tracking-widest text-slate-400 mb-3 px-1">Also played</p>
            <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
              {others.map((p, i) => (
                <div key={p.id} className="flex items-center gap-4 px-4 py-3 border-b border-slate-100 last:border-0">
                  <span className={`${bebas.className} text-lg text-slate-400 w-6 text-center`}>{i + 4}</span>
                  <div className="w-9 h-9 rounded-full overflow-hidden bg-slate-100 ring-1 ring-slate-200">
                    <img src={cldThumb(p.photoURL, 100)} alt={p.name} className="w-full h-full object-cover" />
                  </div>
                  <span className="flex-1 font-medium text-slate-700 truncate">{p.name}</span>
                  <span className={`${bebas.className} text-lg text-slate-900`}>{p.votes}</span>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
