'use client';

import { useState, useEffect, useRef } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, orderBy, onSnapshot, doc, setDoc, getDoc } from 'firebase/firestore';
import { rankSort } from '@/lib/rank';
import { buildReportDoc } from '@/lib/report';
import { generateQrDataUrl } from '@/lib/qr';
import {
  FileText, Loader2, Save, ImagePlus, X, Plus, Trash2, CheckCircle, AlertCircle,
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
  votingPoints: '',
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
  const [photos, setPhotos] = useState([]); // { id, dataUrl, name }
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
    const unsubC = onSnapshot(query(collection(db, 'contestants'), orderBy('votes', 'desc')), (snap) => {
      const d = snap.docs.map((x) => ({ id: x.id, ...x.data() }));
      d.sort(rankSort);
      setContestants(d);
    });
    const unsubA = onSnapshot(query(collection(db, 'attendees'), orderBy('createdAt', 'asc')), (snap) => {
      setAttendees(snap.docs.map((x) => ({ id: x.id, ...x.data() })));
    });

    getDoc(doc(db, 'report', 'draft'))
      .then((s) => {
        if (s.exists()) setForm({ ...BLANK, ...s.data() });
      })
      .catch((e) => console.error('draft load', e))
      .finally(() => setLoading(false));

    return () => {
      unsubC();
      unsubA();
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

  const generate = async () => {
    setGenerating(true);
    try {
      // Only pull pdfmake in when someone actually builds a report.
      const mod = await import('pdfmake/build/pdfmake');
      const pdfMake = mod.default || mod;

      // Times is a PDF standard-14 face: built into every reader, so no font
      // file is embedded and we skip pdfmake's 850KB vfs_fonts bundle entirely.
      pdfMake.addFonts({
        Times: {
          normal: 'Times-Roman',
          bold: 'Times-Bold',
          italics: 'Times-Italic',
          bolditalics: 'Times-BoldItalic',
        },
      });

      // Render the real QR (football logo and all) offscreen. The admin page has
      // no QR on it, so there is no canvas to copy from.
      let qrDataUrl = null;
      try {
        qrDataUrl = await generateQrDataUrl(window.location.origin, 600);
      } catch (err) {
        console.error('QR render failed, continuing without it', err);
      }

      const docDef = buildReportDoc({
        ...form,
        contestants,
        residents: attendees.filter((a) => a.type === 'resident').map((a) => a.label),
        visitors: attendees.filter((a) => a.type === 'visitor').map((a) => a.label),
        qrDataUrl,
        photos: photos.map((p) => p.dataUrl),
      });

      const safe = (form.reportTitle || 'event-report').replace(/[^a-z0-9]+/gi, '-').toLowerCase();
      pdfMake.createPdf(docDef).download(`${safe}.pdf`);
      say('ok', 'Report generated');
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
      {/* auto-included summary */}
      <div className="bg-green-50 border border-green-200 rounded-2xl p-4 text-sm text-green-800">
        <p className="font-semibold mb-1">Pulled in automatically</p>
        <p className="text-green-700">
          {contestants.length} contestants and their votes · {residentCount} residents · {visitorCount} visitors ·
          the voting QR code. You only fill in the write-up below.
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
        <h3 className="font-bold text-slate-700">Cover details</h3>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className={label}>Prepared by</label>
            <input className={field} value={form.preparedBy} onChange={(e) => set('preparedBy', e.target.value)} placeholder="akram" />
          </div>
          <div>
            <label className={label}>Report title</label>
            <input className={field} value={form.reportTitle} onChange={(e) => set('reportTitle', e.target.value)} placeholder="SSIH Summer Kick Off 2026" />
          </div>
          <div>
            <label className={label}>Event</label>
            <input className={field} value={form.eventName} onChange={(e) => set('eventName', e.target.value)} placeholder="SSIH Summer Kick Off (End of Semester Party)" />
          </div>
          <div>
            <label className={label}>Date</label>
            <input className={field} value={form.date} onChange={(e) => set('date', e.target.value)} placeholder="July 18, 2026 (Saturday)" />
          </div>
          <div>
            <label className={label}>Time</label>
            <input className={field} value={form.time} onChange={(e) => set('time', e.target.value)} placeholder="18:00 – 21:30 (including cleanup)" />
          </div>
          <div>
            <label className={label}>Location</label>
            <input className={field} value={form.location} onChange={(e) => set('location', e.target.value)} />
          </div>
          <div className="md:col-span-2">
            <label className={label}>Attendees line</label>
            <input
              className={field}
              value={form.attendeesNote}
              onChange={(e) => set('attendeesNote', e.target.value)}
              placeholder={`Approx. ${attendees.length} (residents and visitors)`}
            />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
        <h3 className="font-bold text-slate-700">Write-up</h3>
        <div>
          <label className={label}>1 · Introduction</label>
          <textarea rows={4} className={field} value={form.introduction} onChange={(e) => set('introduction', e.target.value)} placeholder="Blank line = new paragraph." />
        </div>
        <div>
          <label className={label}>Objectives (one per line)</label>
          <textarea rows={3} className={field} value={form.objectives} onChange={(e) => set('objectives', e.target.value)} placeholder={'To welcome residents…\nTo encourage socialization…'} />
        </div>
        <div>
          <label className={label}>2 · Event execution & activities</label>
          <textarea rows={4} className={field} value={form.execution} onChange={(e) => set('execution', e.target.value)} />
        </div>
        <div>
          <label className={label}>3 · Voting system</label>
          <textarea rows={3} className={field} value={form.votingSystem} onChange={(e) => set('votingSystem', e.target.value)} />
        </div>
        <div>
          <label className={label}>Voting system points (one per line)</label>
          <textarea rows={3} className={field} value={form.votingPoints} onChange={(e) => set('votingPoints', e.target.value)} placeholder={'Vote Once Policy: one final vote per person.\nLive Tally: votes tallied in real time.'} />
        </div>

        <div>
          <label className={label}>4 · Challenges & resolutions</label>
          <div className="space-y-3">
            {form.challenges.map((c, i) => (
              <div key={i} className="bg-slate-50 rounded-xl p-3 border border-slate-200">
                <div className="flex items-start gap-2">
                  <span className="text-xs font-bold text-slate-500 mt-2.5">{i + 1}.</span>
                  <div className="flex-1 space-y-2">
                    <input className={field} value={c.issue} onChange={(e) => setChallenge(i, 'issue', e.target.value)} placeholder="What went wrong" />
                    <input className={field} value={c.resolution} onChange={(e) => setChallenge(i, 'resolution', e.target.value)} placeholder="How it was resolved" />
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

      {/* Photos */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
        <h3 className="font-bold text-slate-700 mb-3">Event photos</h3>
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
            {photos.length} photo{photos.length > 1 ? 's' : ''} — these are not saved to the draft, add them
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
          className="flex-1 px-5 py-3 bg-green-600 hover:bg-green-700 disabled:bg-slate-300 text-white rounded-xl font-semibold flex items-center justify-center gap-2 transition-colors shadow-lg shadow-green-100"
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
