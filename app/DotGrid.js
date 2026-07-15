'use client';

import { useEffect, useRef } from 'react';

// Canvas dot grid where the cursor repels the dots, and the dots have weight.
//
// This is a spring–mass system, not a distortion formula. Each dot remembers its
// home cell and carries a velocity, so it gets shoved away from the cursor,
// coasts on its own momentum, drifts back, and overshoots slightly before
// settling. That inertia is what reads as "weight" — a positional formula
// (newPos = f(cursor)) can never feel like that, because nothing is ever moving
// under its own steam.
//
//   repel : push away, strongest at the tip, fading to nothing at RADIUS
//   spring: constant pull back toward the home cell
//   damp  : bleeds energy so it settles instead of oscillating forever
//
// Efficiency — the loop runs only while dots are actually in motion. Once the
// system reaches equilibrium (cursor parked, or everything home) it stops dead.
// Idle = 0% CPU. Skipped on touch and under prefers-reduced-motion.

const SPACING = 26;
const RADIUS = 130;      // how far the cursor's push reaches
const PUSH = 1.15;       // repulsion strength
const SPRING = 0.055;    // pull home — lower = heavier, slower return
const DAMP = 0.9;        // momentum retained per frame — higher = more coast
const MAX_OFFSET = 34;   // cap so dots never fly across the page
const BASE_R = 1.8;
const GROW = 0.55;       // gentle size lift near the cursor
const MAX_DOTS = 2600;
const REST = 0.015;      // speed below which we call it settled

// Halo: the grid only exists in an ellipse around the centre card and fades to
// nothing before the screen edges. Sized in px (capped) rather than as a raw %
// so the halo stays card-shaped instead of ballooning on a wide monitor.
const HALO_W = 0.38, HALO_W_MAX = 560;
const HALO_H = 0.55, HALO_H_MAX = 520;
const FADE_IN = 0.40;    // solid inside this fraction of the ellipse
const CULL = 0.02;       // below this visibility a dot is dropped entirely

export default function DotGrid({ className = '' }) {
  const ref = useRef(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const finePointer = window.matchMedia('(pointer: fine)').matches;
    if (reduced || !finePointer) return;

    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    let dots = [];
    let w = 0;
    let h = 0;
    let px = -9999;
    let py = -9999;
    let raf = null;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const step = () => {
      const r2 = RADIUS * RADIUS;
      let maxSpeed = 0;

      ctx.clearRect(0, 0, w, h);

      for (let i = 0; i < dots.length; i++) {
        const d = dots[i];

        // --- repulsion from the cursor ---
        const dx = d.x - px;
        const dy = d.y - py;
        const dist2 = dx * dx + dy * dy;
        let near = 0;

        if (dist2 < r2) {
          const dist = Math.sqrt(dist2) || 0.0001;
          near = 1 - dist / RADIUS;
          // squared falloff: firm shove right at the tip, gentle at the edge
          const f = near * near * PUSH;
          d.vx += (dx / dist) * f;
          d.vy += (dy / dist) * f;
        }

        // --- spring back home + damping ---
        d.vx = (d.vx + (d.ox - d.x) * SPRING) * DAMP;
        d.vy = (d.vy + (d.oy - d.y) * SPRING) * DAMP;
        d.x += d.vx;
        d.y += d.vy;

        // --- clamp how far it can stray ---
        const offx = d.x - d.ox;
        const offy = d.y - d.oy;
        const off2 = offx * offx + offy * offy;
        if (off2 > MAX_OFFSET * MAX_OFFSET) {
          const k = MAX_OFFSET / Math.sqrt(off2);
          d.x = d.ox + offx * k;
          d.y = d.oy + offy * k;
        }

        const speed = Math.abs(d.vx) + Math.abs(d.vy);
        if (speed > maxSpeed) maxSpeed = speed;

        // --- paint ---
        // #88bda4 at rest -> #3c745a near the cursor. These alphas are chosen so
        // the dots are actually visible on bg-slate-50: the previous, paler mix
        // rendered at ~1.22 contrast, i.e. invisible at this size.
        const r = BASE_R * (1 + GROW * near);
        const cr = (136 + (60 - 136) * near) | 0;
        const cg = (189 + (116 - 189) * near) | 0;
        const cb = (164 + (90 - 164) * near) | 0;
        ctx.beginPath();
        ctx.arc(d.x, d.y, r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${cr},${cg},${cb},${(0.7 + 0.25 * near) * d.vis})`;
        ctx.fill();
      }

      // Keep stepping only while something still has momentum.
      if (maxSpeed > REST) {
        raf = requestAnimationFrame(step);
      } else {
        raf = null;
      }
    };

    const kick = () => {
      if (raf === null) raf = requestAnimationFrame(step);
    };

    const build = () => {
      const rect = canvas.getBoundingClientRect();
      w = rect.width;
      h = rect.height;
      if (w === 0 || h === 0) return;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const cols = Math.floor(w / SPACING) + 1;
      const rows = Math.floor(h / SPACING) + 1;
      const offX = (w - (cols - 1) * SPACING) / 2;
      const offY = (h - (rows - 1) * SPACING) / 2;

      const cx = w / 2;
      const cy = h / 2;
      const rx = Math.min(w * HALO_W, HALO_W_MAX);
      const ry = Math.min(h * HALO_H, HALO_H_MAX);

      dots = [];
      outer: for (let i = 0; i < cols; i++) {
        for (let j = 0; j < rows; j++) {
          const x = offX + i * SPACING;
          const y = offY + j * SPACING;

          // Elliptical falloff from the centre: 0 at the rim, 1 in the middle.
          const nx = (x - cx) / rx;
          const ny = (y - cy) / ry;
          const nd = Math.sqrt(nx * nx + ny * ny);
          let vis;
          if (nd <= FADE_IN) vis = 1;
          else if (nd >= 1) vis = 0;
          else {
            const t = 1 - (nd - FADE_IN) / (1 - FADE_IN);
            vis = t * t * (3 - 2 * t); // smoothstep, no hard edge
          }

          // Dots out at the edges are never drawn, so don't simulate them either.
          if (vis < CULL) continue;

          dots.push({ ox: x, oy: y, x, y, vx: 0, vy: 0, vis });
          if (dots.length >= MAX_DOTS) break outer;
        }
      }
      kick();
    };

    const onMove = (e) => {
      const rect = canvas.getBoundingClientRect();
      px = e.clientX - rect.left;
      py = e.clientY - rect.top;
      kick();
    };

    const onLeave = () => {
      px = -9999;
      py = -9999;
      kick(); // let them drift home
    };

    build();

    const ro = new ResizeObserver(build);
    ro.observe(canvas);
    window.addEventListener('mousemove', onMove, { passive: true });
    document.addEventListener('mouseleave', onLeave);

    return () => {
      if (raf !== null) cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseleave', onLeave);
    };
  }, []);

  return <canvas ref={ref} aria-hidden="true" className={className} />;
}
