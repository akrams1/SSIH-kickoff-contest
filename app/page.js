'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock, X, Maximize2 } from 'lucide-react';
import { Dancing_Script } from 'next/font/google';
import StyledQR from './StyledQR';

const dancingScript = Dancing_Script({
  subsets: ['latin'],
  weight: '700',
});

export default function Home() {
  const [siteURL, setSiteURL] = useState('');
  const [mounted, setMounted] = useState(false);
  const [showBigQR, setShowBigQR] = useState(false);
  const router = useRouter();

  useEffect(() => {
    setMounted(true);
    setSiteURL(window.location.origin);
  }, []);

  const handleStart = (e) => {
    e.preventDefault();
    setTimeout(() => {
      router.push('/vote');
    }, 100);
  };

  if (!mounted) return <div className="min-h-screen bg-slate-50" />;

  return (
    <div className="min-h-screen bg-slate-50 relative overflow-hidden flex flex-col items-center justify-center p-6">

      {/* Soft static wash — calm, no continuous animation (mobile-friendly) */}
      <div className="absolute -top-24 -left-24 w-[460px] h-[460px] bg-green-100 rounded-full blur-3xl opacity-50 z-0 pointer-events-none" />
      <div className="absolute -bottom-24 -right-24 w-[460px] h-[460px] bg-yellow-100 rounded-full blur-3xl opacity-50 z-0 pointer-events-none" />

      <div className="max-w-md w-full relative z-10">
        <div className="fade-up bg-white/70 backdrop-blur-xl rounded-[2.5rem] shadow-2xl border border-white/50 p-10 text-center flex flex-col items-center">

          {/* Event title lockup */}
          <img
            src="/kickoff-title.webp"
            alt="SSIH Summer Kick Off '26"
            width={1000}
            height={641}
            className="w-full max-w-sm mx-auto mb-6 select-none"
          />

          <p className="text-xl text-slate-400 font-medium mb-12">
            Costume Contest &middot; vote for the best fit
          </p>

          {/* Vote CTA — arcade kick button */}
          <div className="w-full mb-12 flex justify-center">
            <button onClick={handleStart} className="vote-btn select-none">
              LET&rsquo;S VOTE
            </button>
          </div>

          {/* 📱 QR Code */}
          <div
            onClick={() => setShowBigQR(true)}
            className="mb-8 p-1 bg-white rounded-3xl border border-slate-100 shadow-sm relative group cursor-pointer hover:scale-105 transition-transform"
          >
            <div className="bg-slate-50 p-4 rounded-[1.3rem] overflow-hidden">
                {siteURL ? (
                  <StyledQR
                    data={siteURL}
                    size={400}
                    className="w-40 h-40 mx-auto [&>canvas]:w-full [&>canvas]:h-full [&>canvas]:rounded-lg"
                  />
                ) : (
                  <div className="w-40 h-40 bg-slate-100 animate-pulse rounded-xl mx-auto" />
                )}
            </div>
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-white/20 rounded-3xl">
                <Maximize2 className="w-8 h-8 text-slate-500" />
            </div>
            <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-white px-3 py-1 rounded-full shadow-sm border border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap">
              Project Fullscreen
            </div>
          </div>

          {/* 🔒 Admin Link */}
          <div className="w-full pt-4">
            <Link href="/admin">
              <button className="text-slate-300 text-xs font-bold flex items-center justify-center gap-2 mx-auto px-4 py-2 rounded-full hover:bg-slate-50 transition-colors uppercase tracking-wider">
                <Lock className="w-3 h-3" />
                Admin Access
              </button>
            </Link>
          </div>

        </div>
      </div>

      <AnimatePresence>
        {showBigQR && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-green-950/95 backdrop-blur-md flex flex-col items-center justify-center p-8 cursor-zoom-out"
            onClick={() => setShowBigQR(false)}
          >
            <button className="absolute top-8 right-8 text-white/50 hover:text-white transition-colors p-2 bg-white/10 rounded-full">
               <X className="w-8 h-8" />
            </button>
            <motion.div
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.8 }}
              className="bg-white p-6 rounded-3xl shadow-2xl max-w-2xl w-full aspect-square flex items-center justify-center"
              onClick={(e) => e.stopPropagation()}
            >
                <StyledQR
                  data={siteURL}
                  size={1000}
                  className="w-full h-full flex items-center justify-center [&>canvas]:w-full [&>canvas]:h-full [&>canvas]:object-contain"
                />
            </motion.div>
            <div className="mt-8 text-center">
                <h2 className={`${dancingScript.className} text-6xl text-yellow-400 mb-2`}>Scan to Vote</h2>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
