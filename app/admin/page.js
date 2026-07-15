'use client';

import { useState, useEffect } from 'react';
import { db, auth } from '@/lib/firebase';
import {
  collection, query, orderBy, onSnapshot, doc, deleteDoc, updateDoc,
  addDoc, setDoc, serverTimestamp
} from 'firebase/firestore';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { rankSort } from '@/lib/rank';
import { cldThumb } from '@/lib/img';
import { CLOUDINARY_CLOUD_NAME, CLOUDINARY_UPLOAD_PRESET } from '@/lib/config';
import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowLeft, Trash2, Trophy, Loader2, Medal, UploadCloud, Plus, Edit2, Save, X,
  CheckCircle, AlertCircle, Lock, KeyRound, LogOut, DoorOpen, DoorClosed, Users, FileText, Settings
} from 'lucide-react';
import AttendanceTab from './AttendanceTab';
import SettingsTab from './SettingsTab';
import ReportTab from './ReportTab';

// Passkey login, backed by ONE hidden Firebase account so the rules stay
// enforceable. The admin only ever types the passkey; this fixed email is the
// account it signs into behind the scenes. Not a secret (the passkey is).
const ADMIN_EMAIL = process.env.NEXT_PUBLIC_ADMIN_EMAIL || 'admin@ssih-kickoff.web.app';

export default function AdminPage() {
  const [user, setUser] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [signingIn, setSigningIn] = useState(false);

  const [activeTab, setActiveTab] = useState('results');
  const [contestants, setContestants] = useState([]);
  const [loadingData, setLoadingData] = useState(true);

  const [votingOpen, setVotingOpen] = useState(true);
  const [togglingVoting, setTogglingVoting] = useState(false);

  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');

  const [enlargedImg, setEnlargedImg] = useState(null);

  const [newName, setNewName] = useState('');
  const [newPhoto, setNewPhoto] = useState(null);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState('');

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthChecked(true);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'contestants'), orderBy('votes', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      data.sort(rankSort);
      setContestants(data);
      setLoadingData(false);
    });
    const unsubCfg = onSnapshot(doc(db, 'config', 'event'), (snap) => {
      setVotingOpen(!snap.exists() || snap.data().open !== false);
    });
    return () => {
      unsub();
      unsubCfg();
    };
  }, [user]);

  const handleSignIn = async (e) => {
    e.preventDefault();
    setAuthError('');
    setSigningIn(true);
    try {
      await signInWithEmailAndPassword(auth, ADMIN_EMAIL, password);
    } catch (err) {
      console.error('Auth error:', err.code);
      setAuthError('Incorrect passkey.');
    } finally {
      setSigningIn(false);
    }
  };

  const handleSignOut = () => signOut(auth);

  const toggleVoting = async () => {
    setTogglingVoting(true);
    try {
      await setDoc(doc(db, 'config', 'event'), { open: !votingOpen }, { merge: true });
    } catch (err) {
      console.error('Toggle error:', err);
      alert('Could not change voting state.');
    } finally {
      setTogglingVoting(false);
    }
  };

  const handleDelete = async (id, name) => {
    if (!confirm(`Are you sure you want to remove ${name}?`)) return;
    try {
      await deleteDoc(doc(db, 'contestants', id));
    } catch (error) {
      console.error('Delete error:', error);
      alert('Failed to delete contestant.');
    }
  };

  const startEdit = (contestant) => {
    setEditingId(contestant.id);
    setEditName(contestant.name);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditName('');
  };

  const saveEdit = async (id) => {
    const trimmed = editName.trim();
    if (!trimmed) return;
    try {
      await updateDoc(doc(db, 'contestants', id), { name: trimmed });
      setEditingId(null);
    } catch (error) {
      console.error('Update error', error);
      alert('Failed to update name');
    }
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!newName.trim() || !newPhoto) {
      setUploadMessage({ type: 'error', text: 'Name and Photo are required.' });
      return;
    }
    setUploadLoading(true);
    setUploadMessage('');

    try {
      const formData = new FormData();
      formData.append('file', newPhoto);
      formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);

      const res = await fetch(
        `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
        { method: 'POST', body: formData }
      );

      if (!res.ok) throw new Error('Upload failed');
      const data = await res.json();

      await addDoc(collection(db, 'contestants'), {
        name: newName.trim(),
        photoURL: data.secure_url,
        votes: 0,
        createdAt: serverTimestamp()
      });

      setUploadMessage({ type: 'success', text: 'Contestant added successfully!' });
      setNewName('');
      setNewPhoto(null);
    } catch (error) {
      console.error(error);
      setUploadMessage({ type: 'error', text: 'Upload failed. Try again.' });
    } finally {
      setUploadLoading(false);
    }
  };

  if (!authChecked) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-green-600 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 relative overflow-hidden">
        <div className="absolute top-[-10%] right-[-10%] w-96 h-96 bg-green-100 rounded-full mix-blend-multiply filter blur-3xl opacity-40"></div>
        <div className="absolute bottom-[-10%] left-[-10%] w-96 h-96 bg-green-50 rounded-full mix-blend-multiply filter blur-3xl opacity-60"></div>

        <div className="max-w-sm w-full relative z-10 animate-in fade-in zoom-in-95 duration-500">
          <Link href="/" className="inline-flex items-center text-slate-500 hover:text-slate-600 mb-6 transition-colors font-medium text-sm">
            <ArrowLeft className="w-4 h-4 mr-2" /> Back Home
          </Link>

          <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-xl border border-white/60 p-10 text-center">
            <div className="bg-green-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6">
              <Lock className="w-8 h-8 text-green-600" />
            </div>
            <h1 className="text-2xl font-bold text-slate-700 mb-2">Enter Passkey</h1>
            <p className="text-slate-500 mb-8 text-sm">Organizer access only.</p>

            <form onSubmit={handleSignIn} className="space-y-4">
              <div className="relative">
                <KeyRound className="absolute left-4 top-3.5 w-5 h-5 text-slate-400" />
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                  className={`w-full pl-12 pr-4 py-3 bg-white border rounded-xl outline-none transition-all placeholder:text-slate-400 text-slate-700 font-medium ${authError ? 'border-red-300 ring-2 ring-red-100' : 'border-slate-200 focus:border-green-400 focus:ring-2 focus:ring-green-100'}`}
                  placeholder="Passkey" autoComplete="current-password" autoFocus />
              </div>

              {authError && (
                <p className="text-red-500 text-sm font-medium flex items-center justify-center gap-1">
                  <AlertCircle className="w-4 h-4" /> {authError}
                </p>
              )}

              <button type="submit" disabled={signingIn}
                className="w-full bg-green-600 hover:bg-green-700 disabled:bg-slate-300 text-white py-3 rounded-xl font-semibold transition-all active:scale-95 flex items-center justify-center gap-2">
                {signingIn ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Unlock Dashboard'}
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  if (loadingData) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-green-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-12">
      <div className="max-w-5xl mx-auto">

        <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
          <div>
            <Link href="/">
              <button className="inline-flex items-center text-slate-500 hover:text-slate-600 mb-2 transition-colors font-medium text-sm">
                <ArrowLeft className="w-4 h-4 mr-2" /> Home
              </button>
            </Link>
            <h1 className="text-3xl font-bold text-green-700 tracking-tight">Admin Dashboard</h1>
          </div>

          <div className="flex items-center gap-3">
            {/* Voting open/closed toggle */}
            <button
              onClick={toggleVoting}
              disabled={togglingVoting}
              className={`w-36 justify-center px-3 py-2 rounded-xl text-sm font-semibold shadow-sm border transition-colors flex items-center gap-2 disabled:opacity-60 ${
                votingOpen
                  ? 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100'
                  : 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100'
              }`}
              title={votingOpen ? 'Voting is open — click to close' : 'Voting is closed — click to open'}
            >
              {togglingVoting ? <Loader2 className="w-4 h-4 animate-spin" /> : votingOpen ? <DoorOpen className="w-4 h-4" /> : <DoorClosed className="w-4 h-4" />}
              {votingOpen ? 'Voting open' : 'Voting closed'}
            </button>

            <button onClick={handleSignOut}
              className="p-2.5 bg-white border border-slate-200 rounded-xl text-slate-500 hover:text-red-500 hover:border-red-200 transition-all shadow-sm" title="Sign out">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="radio-inputs mb-6">
          {[
            ['results', 'Entries', Trophy],
            ['upload', 'Upload', Plus],
            ['attendance', 'Attendance', Users],
            ['report', 'Report', FileText],
            ['settings', 'Settings', Settings],
          ].map(([id, text, Icon]) => (
            <label className="radio" key={id}>
              <input
                type="radio"
                name="admin-tab"
                checked={activeTab === id}
                onChange={() => setActiveTab(id)}
              />
              <span className="name">
                <Icon className="w-3.5 h-3.5" />
                {text}
              </span>
            </label>
          ))}
        </div>

        <div key={activeTab} className="tab-panel">
          {activeTab === 'results' && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 border-b border-slate-100">
                    <tr>
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Rank</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Contestant</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Votes</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {contestants.map((contestant, index) => (
                      <tr key={contestant.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-4 w-20">
                          <div className="flex items-center gap-3">
                            {index === 0 && <Medal className="w-5 h-5 text-yellow-400" />}
                            {index === 1 && <Medal className="w-5 h-5 text-slate-400" />}
                            {index === 2 && <Medal className="w-5 h-5 text-amber-600" />}
                            <span className={`font-mono text-sm ${index < 3 ? 'font-bold text-slate-700' : 'text-slate-500'}`}>#{index + 1}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-4">
                            <button
                              type="button"
                              onClick={() => setEnlargedImg({ url: contestant.photoURL, name: contestant.name })}
                              className="relative w-12 h-12 rounded-lg overflow-hidden bg-slate-100 ring-1 ring-slate-200 flex-shrink-0 cursor-zoom-in hover:ring-2 hover:ring-green-300 transition-all"
                              title="View larger"
                            >
                              <Image src={cldThumb(contestant.photoURL, 100)} alt={contestant.name} fill className="object-cover" unoptimized />
                            </button>
                            {editingId === contestant.id ? (
                              <div className="flex items-center gap-2">
                                <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)}
                                  className="px-2 py-1 border border-green-400 rounded focus:outline-none focus:ring-2 focus:ring-green-100 text-sm text-slate-900 w-32 md:w-48" autoFocus />
                                <button onClick={() => saveEdit(contestant.id)} className="p-1 text-green-500 hover:bg-green-50 rounded"><Save className="w-4 h-4" /></button>
                                <button onClick={cancelEdit} className="p-1 text-slate-500 hover:bg-slate-100 rounded"><X className="w-4 h-4" /></button>
                              </div>
                            ) : (
                              <span className="font-medium text-slate-700">{contestant.name}</span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <span className="inline-block px-3 py-1 rounded-full bg-green-50 text-green-700 font-bold text-sm">{contestant.votes}</span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button onClick={() => startEdit(contestant)} className="p-2 text-slate-500 hover:text-green-600 hover:bg-green-50 rounded-full transition-all" title="Edit Name">
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button onClick={() => handleDelete(contestant.id, contestant.name)} className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-50 rounded-full transition-all" title="Delete">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {contestants.length === 0 && (
                  <div className="text-center py-16">
                    <Trophy className="w-12 h-12 text-slate-200 mx-auto mb-3" />
                    <p className="text-slate-500">No entries yet. Add costumes from the Upload tab.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'attendance' && <AttendanceTab />}

          {activeTab === 'report' && <ReportTab />}

          {activeTab === 'settings' && <SettingsTab />}

          {activeTab === 'upload' && (
            <div className="max-w-xl mx-auto">
              <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8">
                <h2 className="text-xl font-bold text-slate-700 mb-6 flex items-center gap-2">
                  <UploadCloud className="w-5 h-5 text-green-600" /> Add New Participant
                </h2>

                <form onSubmit={handleUpload} className="space-y-6">
                  <div>
                    <label className="block text-sm font-semibold text-slate-600 mb-2">Name</label>
                    <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)}
                      placeholder="Participant name"
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-500 focus:ring-2 focus:ring-green-100 focus:border-green-400 outline-none transition-all" disabled={uploadLoading} />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-600 mb-2">Photo</label>
                    <div className="relative group">
                      <input type="file" accept="image/*" onChange={(e) => setNewPhoto(e.target.files[0])}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" disabled={uploadLoading} />
                      <div className={`w-full border-2 border-dashed rounded-xl p-8 text-center transition-all ${newPhoto ? 'border-green-400 bg-green-50/30' : 'border-slate-200 hover:border-green-200 hover:bg-slate-50'}`}>
                        {newPhoto ? (
                          <div className="flex flex-col items-center text-green-600">
                            <CheckCircle className="w-8 h-8 mb-2" />
                            <span className="text-sm font-medium truncate max-w-[200px]">{newPhoto.name}</span>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center text-slate-500">
                            <UploadCloud className="w-8 h-8 mb-2" />
                            <span className="text-sm">Click to select photo</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <button type="submit" disabled={uploadLoading}
                    className="w-full bg-green-600 hover:bg-green-700 disabled:bg-slate-200 text-white py-3 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all">
                    {uploadLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Upload Entry'}
                  </button>
                </form>

                {uploadMessage && (
                  <div className={`mt-6 p-4 rounded-xl flex items-center gap-3 text-sm font-medium ${uploadMessage.type === 'error' ? 'bg-red-50 text-red-500 border border-red-100' : 'bg-green-50 text-green-600 border border-green-100'}`}>
                    {uploadMessage.type === 'error' ? <AlertCircle className="w-5 h-5" /> : <CheckCircle className="w-5 h-5" />}
                    {uploadMessage.text}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {enlargedImg && (
        <div
          onClick={() => setEnlargedImg(null)}
          className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex flex-col items-center justify-center p-6 cursor-zoom-out fade-up"
        >
          <button
            onClick={() => setEnlargedImg(null)}
            className="absolute top-6 right-6 p-2 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
            aria-label="Close"
          >
            <X className="w-6 h-6" />
          </button>
          <img
            src={cldThumb(enlargedImg.url, 1000)}
            alt={enlargedImg.name}
            onClick={(e) => e.stopPropagation()}
            className="max-w-full max-h-[80vh] rounded-2xl object-contain shadow-2xl"
          />
          <p className="mt-4 text-white font-medium">{enlargedImg.name}</p>
        </div>
      )}
    </div>
  );
}
