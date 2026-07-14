'use client';

import { useState, useEffect, useRef } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import { Crown, Trophy, Medal, Star, Loader2, Sparkles } from 'lucide-react';
import { Dancing_Script } from 'next/font/google';
import { rankSort } from '@/lib/rank';
import { cldThumb } from '@/lib/img';

const dancingScript = Dancing_Script({ subsets: ['latin'], weight: '700' });

export default function ResultsPage() {
  const [contestants, setContestants] = useState([]);
  const [loading, setLoading] = useState(true);
  // Reveal stepper. 0 = curtain. Places reveal bottom-up: the last place first,
  // the winner last. Total steps = number of podium places (1, 2, or 3).
  const [step, setStep] = useState(0);
  const firedConfetti = useRef(false);

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
    if (firedConfetti.current) return;
    firedConfetti.current = true;
    const end = Date.now() + 3000;
    const frame = () => {
      if (Date.now() > end) return;
      confetti({ startVelocity: 30, spread: 360, ticks: 60, particleCount: 40, origin: { x: Math.random() * 0.2 + 0.1, y: Math.random() - 0.2 } });
      confetti({ startVelocity: 30, spread: 360, ticks: 60, particleCount: 40, origin: { x: Math.random() * 0.2 + 0.7, y: Math.random() - 0.2 } });
      requestAnimationFrame(frame);
    };
    frame();
  };

  const podiumLen = Math.min(3, contestants.length); // number of reveal steps
  const advance = () => setStep((s) => Math.min(s + 1, podiumLen));

  // A place at rank index r (0 = winner) is shown once step reaches podiumLen - r.
  const shown = (r) => step >= podiumLen - r;

  // Fire confetti exactly when the winner (r = 0) becomes visible.
  useEffect(() => {
    if (podiumLen > 0 && step >= podiumLen) fireConfetti();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, podiumLen]);

  if (loading) {
    return (
      <div className="min-h-screen bg-green-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-yellow-400 animate-spin" />
      </div>
    );
  }

  if (contestants.length === 0) {
    return (
      <div className="min-h-screen bg-green-950 flex flex-col items-center justify-center text-center px-6">
        <Trophy className="w-16 h-16 text-yellow-400/60 mb-4" />
        <h1 className={`${dancingScript.className} text-5xl text-yellow-400`}>No entries yet</h1>
        <p className="text-green-200/70 mt-2">Add costumes in the admin panel to see results.</p>
      </div>
    );
  }

  const [first, second, third, ...others] = contestants;
  const revealedAll = step >= podiumLen;
  const topTie = first && second && (first.votes || 0) === (second.votes || 0);

  // Label for the "next" button: name the place that the NEXT tap reveals.
  const nextRankIndex = podiumLen - (step + 1); // rank index revealed next
  const nextLabel = nextRankIndex === 0 ? 'Reveal the winner' : nextRankIndex === 1 ? 'Reveal 2nd place' : 'Reveal 3rd place';

  return (
    <div className="min-h-screen bg-green-950 text-white overflow-x-hidden relative">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-3xl h-96 bg-emerald-500/30 blur-[100px] rounded-full z-0" />

      <div className="relative z-10 max-w-4xl mx-auto px-6 py-12 flex flex-col items-center">
        <h1 className={`${dancingScript.className} text-6xl md:text-8xl text-yellow-400 mb-4 text-center drop-shadow-[0_5px_5px_rgba(0,0,0,0.5)]`}>
          The Winners
        </h1>

        {topTie && revealedAll && (
          <div className="mb-8 text-sm text-yellow-200/80 bg-yellow-400/10 border border-yellow-400/20 rounded-full px-4 py-2 text-center">
            Tie at the top — broken by earliest entry.
          </div>
        )}

        {step === 0 && (
          <motion.button
            onClick={advance}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mt-16 mb-24 flex flex-col items-center gap-4 group"
          >
            <div className="w-28 h-28 rounded-full bg-yellow-400/10 border-2 border-yellow-400/40 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Sparkles className="w-12 h-12 text-yellow-400" />
            </div>
            <span className="text-yellow-200 font-semibold text-lg uppercase tracking-widest">Tap to reveal</span>
          </motion.button>
        )}

        {step >= 1 && (
          <div className="flex flex-wrap justify-center items-end gap-4 md:gap-8 mb-12 w-full min-h-[16rem]">
            <AnimatePresence>
              {second && shown(1) && (
                <motion.div key="second" initial={{ opacity: 0, y: 60 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center order-1">
                  <div className="relative w-24 h-24 md:w-32 md:h-32 rounded-full border-4 border-slate-300 shadow-2xl overflow-hidden mb-3">
                    <img src={cldThumb(second.photoURL, 300)} className="w-full h-full object-cover" />
                  </div>
                  <div className="bg-green-900 px-6 py-2 rounded-t-xl w-32 md:w-40 text-center border-t-4 border-slate-300 h-32 flex flex-col justify-start pt-4 shadow-lg">
                    <Medal className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                    <p className="font-bold text-slate-200 truncate">{second.name}</p>
                    <p className="text-xs text-green-300">{second.votes} Votes</p>
                  </div>
                </motion.div>
              )}

              {first && shown(0) && (
                <motion.div key="first" initial={{ opacity: 0, scale: 0.5, y: 60 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ type: 'spring', bounce: 0.5 }} className="flex flex-col items-center order-0 md:order-2 z-20 -mt-12 md:mt-0">
                  <div className="relative">
                    <Crown className="w-12 h-12 text-yellow-400 absolute -top-10 left-1/2 -translate-x-1/2 animate-bounce" />
                    <div className="w-32 h-32 md:w-48 md:h-48 rounded-full border-4 border-yellow-400 shadow-[0_0_30px_rgba(250,204,21,0.4)] overflow-hidden mb-4">
                      <img src={cldThumb(first.photoURL, 400)} className="w-full h-full object-cover" />
                    </div>
                  </div>
                  <div className="bg-yellow-500 px-6 py-2 rounded-t-xl w-40 md:w-56 text-center border-t-4 border-yellow-300 h-48 flex flex-col justify-start pt-6 shadow-2xl">
                    <Trophy className="w-10 h-10 mx-auto text-yellow-100 mb-2" />
                    <p className="font-bold text-white text-xl truncate">{first.name}</p>
                    <p className="text-sm text-yellow-100 font-bold">{first.votes} Votes</p>
                  </div>
                </motion.div>
              )}

              {third && shown(2) && (
                <motion.div key="third" initial={{ opacity: 0, y: 60 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center order-2 md:order-3">
                  <div className="relative w-24 h-24 md:w-32 md:h-32 rounded-full border-4 border-amber-500 shadow-2xl overflow-hidden mb-3">
                    <img src={cldThumb(third.photoURL, 300)} className="w-full h-full object-cover" />
                  </div>
                  <div className="bg-green-900 px-6 py-2 rounded-t-xl w-32 md:w-40 text-center border-t-4 border-amber-500 h-24 flex flex-col justify-start pt-4 shadow-lg">
                    <Medal className="w-8 h-8 mx-auto text-amber-500 mb-2" />
                    <p className="font-bold text-amber-400 truncate">{third.name}</p>
                    <p className="text-xs text-green-300">{third.votes} Votes</p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {step > 0 && !revealedAll && (
          <button onClick={advance} className="mb-16 bg-yellow-400 hover:bg-yellow-300 text-green-950 font-bold px-8 py-3 rounded-full shadow-lg transition-all active:scale-95 uppercase tracking-wide text-sm">
            {nextLabel}
          </button>
        )}

        {revealedAll && others.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-2xl bg-white/5 backdrop-blur-sm rounded-3xl p-6 border border-white/10">
            <h3 className="text-green-300 text-sm font-bold uppercase tracking-widest mb-4 flex items-center gap-2">
              <Star className="w-4 h-4" /> Honorable Mentions
            </h3>
            {others.map((person, i) => (
              <div key={person.id} className="flex items-center justify-between py-3 border-b border-white/5 last:border-0">
                <div className="flex items-center gap-3">
                  <span className="text-green-400/50 font-mono text-sm w-6">#{i + 4}</span>
                  <div className="w-10 h-10 rounded-full bg-green-800 overflow-hidden">
                    <img src={cldThumb(person.photoURL, 100)} className="w-full h-full object-cover" />
                  </div>
                  <span className="font-medium text-slate-200">{person.name}</span>
                </div>
                <span className="text-green-300/70 text-sm">{person.votes} votes</span>
              </div>
            ))}
          </motion.div>
        )}
      </div>
    </div>
  );
}
