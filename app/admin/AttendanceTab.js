'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { db } from '@/lib/firebase';
import {
  collection, query, orderBy, onSnapshot, addDoc, deleteDoc, doc, serverTimestamp,
} from 'firebase/firestore';
import { UserPlus, Trash2, Search, Loader2, Users, X, AlertCircle } from 'lucide-react';

const norm = (s) => s.trim().toLowerCase();

export default function AttendanceTab() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [entry, setEntry] = useState('');
  const [type, setType] = useState('resident');
  const [filter, setFilter] = useState('');
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState(null);
  const inputRef = useRef(null);
  const flashTimer = useRef(null);

  useEffect(() => {
    const q = query(collection(db, 'attendees'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setRows(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setError(null);
        setLoading(false);
      },
      (err) => {
        // Never leave the spinner running: surface the reason instead.
        console.error('Attendance listener error:', err);
        setError(err.code === 'permission-denied' ? 'permission' : 'unknown');
        setLoading(false);
      }
    );
    return () => {
      unsub();
      if (flashTimer.current) clearTimeout(flashTimer.current);
    };
  }, []);

  const say = (kind, text) => {
    setFlash({ kind, text });
    if (flashTimer.current) clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setFlash(null), 2400);
  };

  const residents = useMemo(() => rows.filter((r) => r.type === 'resident'), [rows]);
  const visitors = useMemo(() => rows.filter((r) => r.type === 'visitor'), [rows]);

  const shown = useMemo(() => {
    const f = norm(filter);
    return f ? rows.filter((r) => norm(r.label || '').includes(f)) : rows;
  }, [rows, filter]);

  const add = async (e) => {
    e.preventDefault();
    const label = entry.trim();
    if (!label) return;

    // Duplicate guard — at a door, the same person gets scanned twice constantly.
    const dupe = rows.find((r) => norm(r.label || '') === norm(label));
    if (dupe) {
      say('warn', `${label} is already checked in`);
      setEntry('');
      inputRef.current?.focus();
      return;
    }

    setBusy(true);
    try {
      await addDoc(collection(db, 'attendees'), {
        label,
        type,
        createdAt: serverTimestamp(),
      });
      say('ok', `Added ${label}`);
      setEntry('');
    } catch (err) {
      console.error('Attendance add error:', err);
      say('err', 'Could not add — check connection');
    } finally {
      setBusy(false);
      inputRef.current?.focus();
    }
  };

  const remove = async (id, label) => {
    if (!confirm(`Remove ${label} from attendance?`)) return;
    try {
      await deleteDoc(doc(db, 'attendees', id));
    } catch (err) {
      console.error('Attendance delete error:', err);
      alert('Could not remove.');
    }
  };

  if (loading) {
    return (
      <div className="py-16 flex justify-center">
        <Loader2 className="w-7 h-7 text-green-600 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-lg mx-auto bg-red-50 border border-red-200 rounded-2xl p-6 text-center">
        <AlertCircle className="w-8 h-8 text-red-500 mx-auto mb-3" />
        <p className="font-semibold text-red-700 mb-1">Cannot read the attendance list</p>
        {error === 'permission' ? (
          <p className="text-sm text-red-600">
            Firestore denied the request. The <code className="font-mono">attendees</code> rules have not been
            published yet — paste <code className="font-mono">firestore.rules</code> into Firebase Console →
            Firestore → Rules → Publish, then reload.
          </p>
        ) : (
          <p className="text-sm text-red-600">Check your connection and reload. Details are in the browser console.</p>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      {/* Counters */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {[
          ['Residents', residents.length],
          ['Visitors', visitors.length],
          ['Total', rows.length],
        ].map(([label, n]) => (
          <div key={label} className="bg-white rounded-xl border border-slate-200 p-4 text-center shadow-sm">
            <p className="text-2xl md:text-3xl font-bold text-green-700">{n}</p>
            <p className="text-xs uppercase tracking-widest text-slate-500 mt-1">{label}</p>
          </div>
        ))}
      </div>

      {/* Quick add */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm mb-6">
        <div className="flex gap-2 mb-3">
          {['resident', 'visitor'].map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => { setType(t); inputRef.current?.focus(); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors ${
                type === t
                  ? 'bg-green-600 text-white'
                  : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        <form onSubmit={add} className="flex gap-2">
          <input
            ref={inputRef}
            value={entry}
            onChange={(e) => setEntry(e.target.value)}
            autoFocus
            autoComplete="off"
            autoCapitalize="characters"
            placeholder={type === 'resident' ? 'Room number, e.g. D405' : 'Visitor name'}
            className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-green-100 focus:border-green-400 outline-none transition-all"
          />
          <button
            type="submit"
            disabled={busy || !entry.trim()}
            className="px-5 py-3 bg-green-600 hover:bg-green-700 disabled:bg-slate-200 text-white rounded-xl font-semibold flex items-center gap-2 transition-colors flex-shrink-0"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
            Add
          </button>
        </form>

        <p className="text-xs text-slate-500 mt-2">
          Press Enter to add and keep typing — the field stays focused.
        </p>

        {flash && (
          <div
            className={`mt-3 px-3 py-2 rounded-lg text-sm font-medium ${
              flash.kind === 'ok'
                ? 'bg-green-50 text-green-700'
                : flash.kind === 'warn'
                ? 'bg-amber-50 text-amber-700'
                : 'bg-red-50 text-red-600'
            }`}
          >
            {flash.text}
          </div>
        )}
      </div>

      {/* Search */}
      <div className="relative mb-3">
        <Search className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Search attendance…"
          className="w-full pl-9 pr-9 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-green-100 focus:border-green-400 outline-none text-sm"
        />
        {filter && (
          <button onClick={() => setFilter('')} className="absolute right-3 top-3 text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* List */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {shown.length === 0 ? (
          <div className="py-14 text-center">
            <Users className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 text-sm">
              {rows.length === 0 ? 'No one checked in yet.' : 'No matches.'}
            </p>
          </div>
        ) : (
          shown.map((r) => (
            <div key={r.id} className="flex items-center gap-3 px-4 py-2.5 border-b border-slate-100 last:border-0">
              <span
                className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full flex-shrink-0 ${
                  r.type === 'resident' ? 'bg-green-50 text-green-700' : 'bg-slate-100 text-slate-600'
                }`}
              >
                {r.type === 'resident' ? 'Res' : 'Vis'}
              </span>
              <span className="flex-1 font-medium text-slate-700 truncate">{r.label}</span>
              <button
                onClick={() => remove(r.id, r.label)}
                className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-all flex-shrink-0"
                title="Remove"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
