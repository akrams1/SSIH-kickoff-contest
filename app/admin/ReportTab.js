'use client';

import { useState, useEffect, useRef } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, orderBy, onSnapshot, doc, setDoc, getDoc, deleteDoc } from 'firebase/firestore';
import { rankSort } from '@/lib/rank';
import { buildReportDoc } from '@/lib/report';
import { generateQrDataUrl } from '@/lib/qr';
import { urlToDataUrl } from '@/lib/upload';
import { cldThumb } from '@/lib/img';
import {
  FileText, Loader2, Save, ImagePlus, X, Plus, Trash2, CheckCircle, AlertCircle, Camera, Check,
} from 'lucide-react';

const BLANK = {
  preparedBy: '',
  reportTitle: '',
  eventName: '',
  date: '',
  time: '',
  location: 'SSIH Auditorium',
  attendeesNote: '',
  introduction: '',
  objectives: '',
  execution: '',
  votingSystem: '',
  challenges: [{ issue: '', resolution: '' }],
};

// Downscale a photo before embedding. A handful of untouched phone photos would
// produce a 50MB PDF; this keeps the whole report to a few MB.
function fileToScaledDataUrl(file, maxDim = 1200, quality = 0.75) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('read failed'));
    reader.onload = () => {
      const img = new window.Image();
      img.onerror = () => reject(new Error('decode failed'));
      img.onload = () => {
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

export default function ReportTab() {
  const [form, setForm] = useState(BLANK);
  const [contestants, setContestants] = useState([]);
  const [attendees, setAttendees] = useState([]);
  const [photos, setPhotos] = useState([]); // from this PC: { id, dataUrl, name }
  const [attendeePhotos, setAttendeePhotos] = useState([]); // from Firestore
  const [picked, setPicked] = useState([]); // selected attendee photo ids
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [msg, setMsg] = useState(null);
  const msgTimer = useRef(null);

  const say = (kind, text) => {
    setMsg({ kind, text });
    if (msgTimer.current) clearTimeout(msgTimer.current);
    msgTimer.current = setTimeout(() => setMsg(null), 3000);
  };

  useEffect(() => {
    const unsubC = onSnapshot(
      query(collection(db, 'contestants'), orderBy('votes', 'desc')),
      (snap) => {
        const d = snap.docs.map((x) => ({ id: x.id, ...x.data() }));
        d.sort(rankSort);
        setContestants(d);
      },
      (err) => console.error('Contestants listener error:', err)
    );
    const unsubA = onSnapshot(
      query(collection(db, 'attendees'), orderBy('createdAt', 'asc')),
      (snap) => setAttendees(snap.docs.map((x) => ({ id: x.id, ...x.data() }))),
      (err) => console.error('Attendees listener error:', err)
    );
    const unsubP = onSnapshot(
      query(collection(db, 'photos'), orderBy('createdAt', 'desc')),
      (snap) => setAttendeePhotos(snap.docs.map((x) => ({ id: x.id, ...x.data() }))),
      (err) => console.error('Photos listener error:', err)
    );

    getDoc(doc(db, 'report', 'draft'))
      .then((s) => {
        if (s.exists()) setForm({ ...BLANK, ...s.data() });
      })
      .catch((e) => console.error('draft load', e))
      .finally(() => setLoading(false));

    return () => {
      unsubC();
      unsubA();
      unsubP();
      if (msgTimer.current) clearTimeout(msgTimer.current);
    };
  }, []);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const setChallenge = (i, k, v) =>
    setForm((f) => {
      const next = f.challenges.map((c, idx) => (idx === i ? { ...c, [k]: v } : c));
      return { ...f, challenges: next };
    });

  const addChallenge = () =>
    setForm((f) => ({ ...f, challenges: [...f.challenges, { issue: '', resolution: '' }] }));

  const removeChallenge = (i) =>
    setForm((f) => ({ ...f, challenges: f.challenges.filter((_, idx) => idx !== i) }));

  const saveDraft = async () => {
    setSaving(true);
    try {
      await setDoc(doc(db, 'report', 'draft'), form, { merge: true });
      say('ok', 'Draft saved');
    } catch (e) {
      console.error(e);
      say('err', 'Could not save draft');
    } finally {
      setSaving(false);
    }
  };

  const onPhotos = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    try {
      const added = await Promise.all(
        files.map(async (f) => ({
          id: `${f.name}-${f.size}-${Math.random().toString(36).slice(2, 7)}`,
          name: f.name,
          dataUrl: await fileToScaledDataUrl(f),
        }))
      );
      setPhotos((p) => [...p, ...added]);
    } catch (err) {
      console.error(err);
      say('err', 'One of those images could not be read');
    }
    e.target.value = '';
  };

  const togglePick = (id) =>
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  const removeAttendeePhoto = async (id) => {
    if (!confirm('Delete this photo? It is removed for everyone.')) return;
    try {
      await deleteDoc(doc(db, 'photos', id));
      setPicked((p) => p.filter((x) => x !== id));
    } catch (err) {
      console.error(err);
      say('err', 'Could not delete that photo');
    }
  };

  const generate = async () => {
    setGenerating(true);
    try {
      // Only pull pdfmake in when someone actually builds a report.
      const [pdfMod, timesMod] = await Promise.all([
        import('pdfmake/build/pdfmake'),
        import('pdfmake/build/standard-fonts/Times'),
      ]);
      const pdfMake = pdfMod.default || pdfMod;
      const times = timesMod.default || timesMod;

      // Times is a PDF standard-14 face, so no font file is embedded in the
      // output and we skip pdfmake's 850KB vfs_fonts bundle. It must be added
      // as a *font container*, not addFonts(): in the browser there is no disk,
      // so pdfkit needs the AFM metrics loaded into the virtual filesystem.
      // addFonts alone registers the name but not the metrics, and rendering
      // then fails at download time.
      if (typeof pdfMake.addFontContainer === 'function') {
        pdfMake.addFontContainer(times);
      } else {
        pdfMake.addVirtualFileSystem?.(times.vfs);
        pdfMake.addFonts(times.fonts);
      }

      // Render the real QR (football logo and all) offscreen. The admin page has
      // no QR on it, so there is no canvas to copy from.
      let qrDataUrl = null;
      try {
        qrDataUrl = await generateQrDataUrl(window.location.origin, 600);
      } catch (err) {
        console.error('QR render failed, continuing without it', err);
      }

      // Attendee photos live on Cloudinary; pdfmake needs bytes, so fetch the
      // picked ones back as data URLs (at a sane width, not the original).
      const pickedUrls = [];
      for (const id of picked) {
        const p = attendeePhotos.find((x) => x.id === id);
        if (!p?.url) continue;
        try {
          pickedUrls.push(await urlToDataUrl(cldThumb(p.url, 1200)));
        } catch (err) {
          console.error('Could not fetch attendee photo, skipping:', err);
        }
      }

      const docDef = buildReportDoc({
        ...form,
        contestants,
        residents: attendees.filter((a) => a.type === 'resident').map((a) => a.label),
        visitors: attendees.filter((a) => a.type === 'visitor').map((a) => a.label),
        qrDataUrl,
        photos: [...pickedUrls, ...photos.map((p) => p.dataUrl)],
      });

      const safe = (form.reportTitle || 'event-report').replace(/[^a-z0-9]+/gi, '-').toLowerCase();
      // download() is async in pdfmake 0.3 — without await, a failure becomes an
      // unhandled rejection and we would claim success while nothing downloads.
      await pdfMake.createPdf(docDef).download(`${safe}.pdf`);
      say('ok', 'Report downloaded');
    } catch (e) {
      console.error('PDF error', e);
      say('err', 'Could not generate the PDF');
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="py-16 flex justify-center">
        <Loader2 className="w-7 h-7 text-green-600 animate-spin" />
      </div>
    );
  }

  const field =
    'w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-green-100 focus:border-green-400 outline-none transition-all text-sm';
  const label = 'block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wider';

  const residentCount = attendees.filter((a) => a.type === 'resident').length;
  const visitorCount = attendees.length - residentCount;

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      {/* Pulled in automatically */}
      <div className="grid grid-cols-3 gap-3">
        {[
          ['Contestants', contestants.length],
          ['Residents', residentCount],
          ['Visitors', visitorCount],
        ].map(([label, n]) => (
          <div key={label} className="bg-white rounded-xl border border-slate-200 p-3 text-center shadow-sm">
            <p className="text-2xl font-bold text-green-700 leading-none">{n}</p>
            <p className="text-[10px] uppercase tracking-widest text-slate-500 mt-1.5">{label}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
        <h3 className="font-bold text-slate-700">Cover details</h3>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className={label}>Prepared by</label>
            <input className={field} value={form.preparedBy} onChange={(e) => set('preparedBy', e.target.value)} />
          </div>
          <div>
            <label className={label}>Report title</label>
            <input className={field} value={form.reportTitle} onChange={(e) => set('reportTitle', e.target.value)} />
          </div>
          <div>
            <label className={label}>Event</label>
            <input className={field} value={form.eventName} onChange={(e) => set('eventName', e.target.value)} />
          </div>
          <div>
            <label className={label}>Date</label>
            <input className={field} value={form.date} onChange={(e) => set('date', e.target.value)} />
          </div>
          <div>
            <label className={label}>Time</label>
            <input className={field} value={form.time} onChange={(e) => set('time', e.target.value)} />
          </div>
          <div>
            <label className={label}>Location</label>
            <input className={field} value={form.location} onChange={(e) => set('location', e.target.value)} />
          </div>
          <div className="md:col-span-2">
            <label className={label}>Attendees line</label>
            <input className={field} value={form.attendeesNote} onChange={(e) => set('attendeesNote', e.target.value)} />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
        <h3 className="font-bold text-slate-700">Write-up</h3>
        <div>
          <label className={label}>Introduction</label>
          <textarea rows={4} className={field} value={form.introduction} onChange={(e) => set('introduction', e.target.value)} />
        </div>
        <div>
          <label className={label}>Objectives (one per line)</label>
          <textarea rows={3} className={field} value={form.objectives} onChange={(e) => set('objectives', e.target.value)} />
        </div>
        <div>
          <label className={label}>Event execution & activities</label>
          <textarea rows={4} className={field} value={form.execution} onChange={(e) => set('execution', e.target.value)} />
        </div>
        <div>
          <label className={label}>Voting system</label>
          <textarea rows={3} className={field} value={form.votingSystem} onChange={(e) => set('votingSystem', e.target.value)} />
        </div>

        <div>
          <label className={label}>Challenges & resolutions</label>
          <div className="space-y-3">
            {form.challenges.map((c, i) => (
              <div key={i} className="bg-slate-50 rounded-xl p-3 border border-slate-200">
                <div className="flex items-start gap-2">
                  <span className="text-xs font-bold text-slate-500 mt-2.5">{i + 1}.</span>
                  <div className="flex-1 space-y-2">
                    <input className={field} value={c.issue} onChange={(e) => setChallenge(i, 'issue', e.target.value)} />
                    <input className={field} value={c.resolution} onChange={(e) => setChallenge(i, 'resolution', e.target.value)} />
                  </div>
                  {form.challenges.length > 1 && (
                    <button onClick={() => removeChallenge(i)} className="p-1.5 text-slate-400 hover:text-red-500 rounded" title="Remove">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
          <button onClick={addChallenge} className="mt-2 text-sm font-semibold text-green-700 hover:text-green-800 flex items-center gap-1">
            <Plus className="w-4 h-4" /> Add challenge
          </button>
        </div>

      </div>

      {/* Photos from attendees */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-slate-700 flex items-center gap-2">
            <Camera className="w-4 h-4 text-green-600" />
            From attendees
          </h3>
          <span className="text-xs text-slate-500">
            {attendeePhotos.length === 0
              ? 'none yet'
              : `${picked.length} of ${attendeePhotos.length} selected`}
          </span>
        </div>

        {attendeePhotos.length === 0 ? (
          <p className="text-sm text-slate-500 py-6 text-center">
            Photos guests upload from the voting page will appear here.
          </p>
        ) : (
          <div className="grid grid-cols-3 md:grid-cols-5 gap-2 max-h-72 overflow-y-auto">
            {attendeePhotos.map((p) => {
              const on = picked.includes(p.id);
              return (
                <div key={p.id} className="relative group aspect-square rounded-lg overflow-hidden bg-slate-100">
                  <button
                    type="button"
                    onClick={() => togglePick(p.id)}
                    className="absolute inset-0 w-full h-full"
                    title={on ? 'Deselect' : 'Select for the report'}
                  >
                    <img src={cldThumb(p.url, 240)} alt="" className="w-full h-full object-cover" />
                    {on && (
                      <span className="absolute inset-0 bg-green-600/35 ring-2 ring-inset ring-green-600 flex items-center justify-center">
                        <span className="bg-green-600 text-white rounded-full p-1">
                          <Check className="w-3.5 h-3.5" />
                        </span>
                      </span>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => removeAttendeePhoto(p.id)}
                    className="absolute top-1 right-1 bg-slate-900/70 hover:bg-red-600 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-all"
                    title="Delete for everyone"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Photos from this device */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
        <h3 className="font-bold text-slate-700 mb-3">From this computer</h3>
        <div className="relative">
          <input type="file" accept="image/*" multiple onChange={onPhotos} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
          <div className="border-2 border-dashed border-slate-200 hover:border-green-300 hover:bg-slate-50 rounded-xl p-6 text-center transition-all">
            <ImagePlus className="w-7 h-7 text-slate-400 mx-auto mb-1" />
            <span className="text-sm text-slate-500">Click to add photos (resized automatically)</span>
          </div>
        </div>

        {photos.length > 0 && (
          <div className="grid grid-cols-3 md:grid-cols-4 gap-2 mt-4">
            {photos.map((p) => (
              <div key={p.id} className="relative group aspect-[4/3] rounded-lg overflow-hidden bg-slate-100">
                <img src={p.dataUrl} alt={p.name} className="w-full h-full object-cover" />
                <button
                  onClick={() => setPhotos((all) => all.filter((x) => x.id !== p.id))}
                  className="absolute top-1 right-1 bg-slate-900/70 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Remove"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}
        {photos.length > 0 && (
          <p className="text-xs text-slate-500 mt-2">
            {photos.length} added from this computer. These are not saved to the draft, so add them
            just before generating.
          </p>
        )}
      </div>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-3">
        <button
          onClick={saveDraft}
          disabled={saving}
          className="flex-1 px-5 py-3 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl font-semibold flex items-center justify-center gap-2 transition-colors shadow-sm"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save draft
        </button>
        <button
          onClick={generate}
          disabled={generating}
          className="flex-1 px-5 py-3 bg-green-600 hover:bg-green-700 disabled:bg-slate-300 text-white rounded-xl font-semibold flex items-center justify-center gap-2 transition-colors"
        >
          {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
          Generate PDF
        </button>
      </div>

      {msg && (
        <div
          className={`p-3 rounded-xl flex items-center gap-2 text-sm font-medium ${
            msg.kind === 'ok'
              ? 'bg-green-50 text-green-700 border border-green-200'
              : 'bg-red-50 text-red-600 border border-red-200'
          }`}
        >
          {msg.kind === 'ok' ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          {msg.text}
        </div>
      )}
    </div>
  );
}
