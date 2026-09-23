'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Trash2,
  ShieldLock,
  Inbox,
  Clock,
  RefreshCw,
  UploadCloud,
  Layers,
  CheckCircle2,
  AlertCircle,
  MessageSquare,
  Users,
  BarChart3,
  Activity,
  Sparkles,
  Pencil,
  Check,
  X,
} from 'lucide-react';
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  doc,
  deleteDoc,
  addDoc,
  setDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';

// Konfigurasi Cloudinary
const CLOUDINARY_CLOUD_NAME = 'cx9rcd4t';
const CLOUDINARY_UPLOAD_PRESET = 'dekatan_template';

interface FeedbackItem {
  id: string;
  name: string;
  category: string;
  message: string;
  createdAt: any;
}

interface CustomTemplate {
  id: string;
  name: string;
  category: 'retro' | 'love' | 'cute' | 'minimal';
  format: 'strip3' | 'strip4' | 'grid';
  overlayUrl: string;
  isDark: boolean;
  createdAt: any;
}

export default function AdminDashboardPage() {
  const [pin, setPin] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [activeTab, setActiveTab] = useState<'templates' | 'feedback' | 'analytics'>('templates');

  // State Feedback
  const [feedbacks, setFeedbacks] = useState<FeedbackItem[]>([]);
  const [isLoadingFeedback, setIsLoadingFeedback] = useState(true);

  // State Template
  const [templates, setTemplates] = useState<CustomTemplate[]>([]);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(true);

  // State Pengunjung & Target Beta
  const [visitorCount, setVisitorCount] = useState<number>(0);
  const [betaTarget, setBetaTarget] = useState<number>(50);
  const [isEditingTarget, setIsEditingTarget] = useState(false);
  const [inputTarget, setInputTarget] = useState<string>('50');
  const [isSavingTarget, setIsSavingTarget] = useState(false);
  const [isLoadingVisitors, setIsLoadingVisitors] = useState(true);

  // Form State Upload Template
  const [name, setName] = useState('');
  const [category, setCategory] = useState<'retro' | 'love' | 'cute' | 'minimal'>('retro');
  const [format, setFormat] = useState<'strip3' | 'strip4' | 'grid'>('strip4');
  const [isDark, setIsDark] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (pin === '1394') {
      setIsAuthenticated(true);
    } else {
      alert('PIN Admin salah!');
      setPin('');
    }
  };

  // 1. Dengarkan Pesan Masukan
  useEffect(() => {
    if (!isAuthenticated) return;
    setIsLoadingFeedback(true);
    const q = query(collection(db, 'feedbacks'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const items: FeedbackItem[] = [];
        snapshot.forEach((docSnap) => {
          items.push({ id: docSnap.id, ...(docSnap.data() as any) });
        });
        setFeedbacks(items);
        setIsLoadingFeedback(false);
      },
      (err) => {
        console.error('Firestore feedback error:', err);
        setIsLoadingFeedback(false);
      }
    );
    return () => unsubscribe();
  }, [isAuthenticated]);

  // 2. Dengarkan Template Aktif
  useEffect(() => {
    if (!isAuthenticated) return;
    setIsLoadingTemplates(true);
    const q = query(collection(db, 'templates'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const items: CustomTemplate[] = [];
        snapshot.forEach((docSnap) => {
          items.push({ id: docSnap.id, ...(docSnap.data() as any) });
        });
        setTemplates(items);
        setIsLoadingTemplates(false);
      },
      (err) => {
        console.error('Firestore templates error:', err);
        setIsLoadingTemplates(false);
      }
    );
    return () => unsubscribe();
  }, [isAuthenticated]);

  // 3. Dengarkan Statistik Pengunjung & Target Beta Real-time
  useEffect(() => {
    if (!isAuthenticated) return;
    setIsLoadingVisitors(true);
    const unsubscribe = onSnapshot(
      doc(db, 'stats', 'visitors'),
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          setVisitorCount(data?.total || 0);
          const target = data?.betaTarget ?? 50;
          setBetaTarget(target);
          setInputTarget(target.toString());
        }
        setIsLoadingVisitors(false);
      },
      (err) => {
        console.error('Firestore visitors error:', err);
        setIsLoadingVisitors(false);
      }
    );
    return () => unsubscribe();
  }, [isAuthenticated]);

  // Simpan Target Sesi Beta Baru ke Firestore
  const handleSaveTarget = async (e: React.FormEvent) => {
    e.preventDefault();
    const newTarget = parseInt(inputTarget, 10);
    if (isNaN(newTarget) || newTarget <= 0) {
      alert('Masukkan angka target yang valid (minimal 1)!');
      return;
    }

    setIsSavingTarget(true);
    try {
      await setDoc(
        doc(db, 'stats', 'visitors'),
        { betaTarget: newTarget },
        { merge: true }
      );
      setIsEditingTarget(false);
    } catch (err) {
      console.error('Gagal menyimpan target beta:', err);
      alert('Gagal menyimpan target ke database.');
    } finally {
      setIsSavingTarget(false);
    }
  };

  // Hapus Masukan
  const handleDeleteFeedback = async (id: string) => {
    if (!confirm('Hapus pesan masukan ini?')) return;
    try {
      await deleteDoc(doc(db, 'feedbacks', id));
    } catch (err) {
      console.error('Gagal menghapus feedback:', err);
    }
  };

  // Hapus Template
  const handleDeleteTemplate = async (id: string) => {
    if (!confirm('Hapus template ini dari katalog bilik foto?')) return;
    try {
      await deleteDoc(doc(db, 'templates', id));
    } catch (err) {
      console.error('Gagal menghapus template:', err);
    }
  };

  // Pilih Berkas PNG
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.includes('png')) {
      alert('Wajib format PNG transparan agar foto pengguna terlihat di balik bingkai.');
      return;
    }

    setSelectedFile(file);
    setFilePreview(URL.createObjectURL(file));
  };

  // Unggah Template ke Cloudinary lalu Simpan ke Firestore
  const handleUploadTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !selectedFile) {
      alert('Nama dan berkas gambar wajib diisi.');
      return;
    }

    setStatusMsg(null);
    setUploadProgress(20);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
      formData.append('folder', 'dekatan_templates');

      setUploadProgress(50);

      const res = await fetch(
        `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
        {
          method: 'POST',
          body: formData,
        }
      );

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error?.message || 'Gagal mengunggah ke Cloudinary.');
      }

      setUploadProgress(85);

      await addDoc(collection(db, 'templates'), {
        name: name.trim(),
        category,
        format,
        isDark,
        overlayUrl: data.secure_url,
        createdAt: serverTimestamp(),
      });

      setUploadProgress(100);
      setStatusMsg({ type: 'success', text: 'Template berhasil dipublikasikan ke katalog!' });
      setName('');
      setSelectedFile(null);
      setFilePreview(null);
      setTimeout(() => setUploadProgress(null), 1000);
    } catch (err: any) {
      console.error(err);
      setStatusMsg({
        type: 'error',
        text: err.message || 'Terjadi kendala saat mengunggah template.',
      });
      setUploadProgress(null);
    }
  };

  // Layar Kunci PIN
  if (!isAuthenticated) {
    return (
      <main className="min-h-screen bg-[#FAF7F2] flex items-center justify-center px-4">
        <div className="bg-white w-full max-w-xs p-6 rounded-3xl shadow-xl border border-stone-200 text-center">
          <div className="w-12 h-12 bg-rose-50 text-[#DA6868] rounded-2xl flex items-center justify-center mx-auto mb-3">
            <ShieldLock className="w-6 h-6" />
          </div>
          <h2 className="text-base font-bold text-stone-800">Dashboard Admin Dekatan</h2>
          <p className="text-xs text-stone-500 mb-4 mt-0.5">Masukkan PIN untuk membuka menu admin.</p>

          <form onSubmit={handleLogin} className="flex flex-col gap-3">
            <input
              type="password"
              maxLength={6}
              placeholder="Masukkan PIN"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              className="w-full text-center px-4 py-2.5 rounded-xl border border-stone-300 text-sm font-mono tracking-widest focus:outline-none focus:border-[#DA6868]"
            />
            <button
              type="submit"
              className="w-full py-2.5 bg-[#DA6868] text-white font-semibold text-xs rounded-xl shadow-md hover:bg-[#c85656] transition"
            >
              Buka Dashboard
            </button>
          </form>
          <Link href="/" className="inline-block mt-4 text-xs text-stone-400 hover:text-stone-600">
            Kembali ke Beranda
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#FAF7F2] px-4 py-6 md:py-8 max-w-5xl mx-auto">
      {/* Bar Atas Navigasi */}
      <div className="flex items-center justify-between mb-5">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs md:text-sm font-medium text-slate-600 hover:text-[#DA6868] transition"
        >
          <ArrowLeft className="w-4 h-4" />
          Beranda
        </Link>
        <span className="text-xs font-bold text-[#DA6868] uppercase tracking-wider bg-rose-50 px-3 py-1 rounded-full border border-rose-100">
          Panel Administrator
        </span>
      </div>

      {/* Tab Switcher: 3 Tab Menu */}
      <div className="w-full bg-stone-200/70 p-1.5 rounded-2xl flex flex-col sm:flex-row gap-2 mb-6">
        <button
          onClick={() => setActiveTab('templates')}
          className={`flex-1 py-2.5 rounded-xl text-xs md:text-sm font-bold flex items-center justify-center gap-2 transition ${
            activeTab === 'templates'
              ? 'bg-white text-[#DA6868] shadow-xs'
              : 'text-stone-600 hover:text-stone-900'
          }`}
        >
          <UploadCloud className="w-4 h-4" />
          Upload & Kelola Template ({templates.length})
        </button>

        <button
          onClick={() => setActiveTab('feedback')}
          className={`flex-1 py-2.5 rounded-xl text-xs md:text-sm font-bold flex items-center justify-center gap-2 transition ${
            activeTab === 'feedback'
              ? 'bg-white text-[#DA6868] shadow-xs'
              : 'text-stone-600 hover:text-stone-900'
          }`}
        >
          <MessageSquare className="w-4 h-4" />
          Masukan Pengunjung ({feedbacks.length})
        </button>

        <button
          onClick={() => setActiveTab('analytics')}
          className={`flex-1 py-2.5 rounded-xl text-xs md:text-sm font-bold flex items-center justify-center gap-2 transition ${
            activeTab === 'analytics'
              ? 'bg-white text-[#DA6868] shadow-xs'
              : 'text-stone-600 hover:text-stone-900'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          Statistik Pengunjung ({visitorCount})
        </button>
      </div>

      {/* ================= TAB 1: UPLOAD & KELOLA TEMPLATE ================= */}
      {activeTab === 'templates' && (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-6 animate-fade-in">
          {/* Form Tambah Template */}
          <div className="md:col-span-2 bg-white p-5 rounded-3xl shadow-sm border border-stone-200 h-fit">
            <h2 className="text-base font-bold text-stone-800 mb-1 flex items-center gap-2">
              <UploadCloud className="w-5 h-5 text-[#DA6868]" />
              Tambah Frame PNG
            </h2>
            <p className="text-[11px] text-stone-500 mb-4">
              Pastikan area foto dibuat transparan agar foto pengguna terlihat.
            </p>

            {statusMsg && (
              <div
                className={`p-3 rounded-xl text-xs mb-4 flex items-center gap-2 ${
                  statusMsg.type === 'success'
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'bg-red-50 text-red-700 border border-red-200'
                }`}
              >
                {statusMsg.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 shrink-0" />
                )}
                <span>{statusMsg.text}</span>
              </div>
            )}

            <form onSubmit={handleUploadTemplate} className="flex flex-col gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-stone-600 mb-1">
                  Nama Desain Frame:
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Y2K Cyber Scrapbook"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-xs rounded-xl border border-stone-200 focus:outline-none focus:border-[#DA6868]"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-semibold text-stone-600 mb-1">Format:</label>
                  <select
                    value={format}
                    onChange={(e) => setFormat(e.target.value as any)}
                    className="w-full px-2.5 py-2 text-xs rounded-xl border border-stone-200 bg-white focus:outline-none focus:border-[#DA6868]"
                  >
                    <option value="strip4">Strip (1×4)</option>
                    <option value="strip3">Strip (1×3)</option>
                    <option value="grid">Grid (2×2)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-stone-600 mb-1">Kategori:</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as any)}
                    className="w-full px-2.5 py-2 text-xs rounded-xl border border-stone-200 bg-white focus:outline-none focus:border-[#DA6868]"
                  >
                    <option value="retro">Retro & Film</option>
                    <option value="love">Aesthetic Love</option>
                    <option value="cute">Cute & Fun</option>
                    <option value="minimal">Minimalis</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-2 p-2.5 rounded-xl bg-stone-50 border border-stone-200">
                <input
                  type="checkbox"
                  id="isDarkCheck"
                  checked={isDark}
                  onChange={(e) => setIsDark(e.target.checked)}
                  className="w-4 h-4 accent-[#DA6868] rounded cursor-pointer"
                />
                <label htmlFor="isDarkCheck" className="text-xs text-stone-700 font-medium cursor-pointer">
                  Desain tema gelap (logo & teks otomatis putih)
                </label>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-stone-600 mb-1">
                  Pilih Berkas PNG Transparan:
                </label>
                <input
                  type="file"
                  accept="image/png"
                  onChange={handleFileChange}
                  required
                  className="w-full text-xs text-stone-500 file:mr-2 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-rose-50 file:text-[#DA6868] hover:file:bg-rose-100 cursor-pointer"
                />
              </div>

              {filePreview && (
                <div className="mt-1 p-2 bg-stone-100 rounded-xl border border-stone-200 flex flex-col items-center">
                  <span className="text-[10px] text-stone-400 mb-1">Pratinjau File:</span>
                  <div className="relative w-28 h-40 bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] [background-size:8px_8px] rounded-lg overflow-hidden border border-stone-300">
                    {/* eslint-disable-next-html-element/no-img-element */}
                    <img src={filePreview} alt="Pratinjau" className="w-full h-full object-contain" />
                  </div>
                </div>
              )}

              {uploadProgress !== null && (
                <div className="w-full bg-stone-100 rounded-full h-2 overflow-hidden mt-1">
                  <div
                    className="bg-[#DA6868] h-full transition-all duration-200"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              )}

              <button
                type="submit"
                disabled={uploadProgress !== null}
                className="w-full mt-2 py-2.5 bg-[#DA6868] text-white font-bold text-xs rounded-xl shadow-md hover:bg-[#c85656] disabled:opacity-50 active:scale-95 transition"
              >
                {uploadProgress !== null ? `Mengunggah (${uploadProgress}%)...` : 'Simpan & Publikasikan'}
              </button>
            </form>
          </div>

          {/* Daftar Template Aktif */}
          <div className="md:col-span-3 bg-white p-5 rounded-3xl shadow-sm border border-stone-200">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-bold text-stone-800 flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-[#DA6868]" />
                  Koleksi Template Aktif
                </h3>
                <p className="text-xs text-stone-500">
                  Desain di bawah langsung muncul di katalog bilik foto pengguna.
                </p>
              </div>
              <span className="text-xs font-semibold px-2.5 py-1 bg-stone-100 rounded-full text-stone-600">
                {templates.length} Desain
              </span>
            </div>

            {isLoadingTemplates ? (
              <div className="py-12 text-center text-xs text-stone-400">Memuat koleksi frame...</div>
            ) : templates.length === 0 ? (
              <div className="py-12 text-center text-xs text-stone-400 border-2 border-dashed border-stone-200 rounded-2xl">
                Belum ada bingkai PNG khusus yang diunggah.
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {templates.map((item) => (
                  <div
                    key={item.id}
                    className="p-2.5 rounded-2xl border border-stone-200 bg-[#FAF7F2] flex flex-col justify-between group relative"
                  >
                    <div className="relative w-full aspect-[9/16] bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] [background-size:6px_6px] rounded-xl overflow-hidden border border-stone-200 mb-2">
                      {/* eslint-disable-next-html-element/no-img-element */}
                      <img
                        src={item.overlayUrl}
                        alt={item.name}
                        className="w-full h-full object-contain"
                      />
                    </div>

                    <div>
                      <h4 className="text-xs font-bold text-stone-800 line-clamp-1">{item.name}</h4>
                      <div className="flex items-center justify-between mt-1 text-[10px] text-stone-500">
                        <span className="uppercase font-semibold text-[#DA6868]">{item.format}</span>
                        <span>{item.category}</span>
                      </div>
                    </div>

                    <button
                      onClick={() => handleDeleteTemplate(item.id)}
                      className="absolute top-4 right-4 bg-black/60 text-white p-1.5 rounded-full hover:bg-red-500 transition opacity-0 group-hover:opacity-100"
                      title="Hapus Desain"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ================= TAB 2: MASUKAN PENGUNJUNG ================= */}
      {activeTab === 'feedback' && (
        <div className="bg-white rounded-3xl p-5 md:p-6 shadow-sm border border-stone-200 animate-fade-in">
          <h1 className="text-lg font-bold text-stone-800 mb-1 flex items-center gap-2">
            <Inbox className="w-5 h-5 text-[#DA6868]" />
            Daftar Masukan & Kritik Pengunjung
          </h1>
          <p className="text-xs text-stone-500 mb-5">
            Pesan tersinkronisasi secara otomatis begitu pengunjung mengirimkan masukan.
          </p>

          {isLoadingFeedback ? (
            <div className="py-12 flex flex-col items-center text-stone-400 text-xs">
              <RefreshCw className="w-6 h-6 animate-spin mb-2" />
              Memuat pesan...
            </div>
          ) : feedbacks.length === 0 ? (
            <div className="py-12 text-center text-stone-400 text-xs">
              Belum ada pesan masukan yang masuk.
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {feedbacks.map((item) => {
                const formattedDate = item.createdAt?.toDate
                  ? item.createdAt.toDate().toLocaleString('id-ID', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                  : 'Baru saja';

                return (
                  <div
                    key={item.id}
                    className="p-4 rounded-2xl border border-stone-200 bg-[#FAF7F2]/60 hover:bg-[#FAF7F2] transition flex flex-col gap-2 relative"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-stone-800">{item.name}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-rose-50 text-[#DA6868] border border-rose-100">
                          {item.category}
                        </span>
                      </div>
                      <button
                        onClick={() => handleDeleteFeedback(item.id)}
                        className="text-stone-400 hover:text-red-500 p-1 transition"
                        title="Hapus Pesan"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <p className="text-xs text-stone-700 whitespace-pre-wrap leading-relaxed">
                      {item.message}
                    </p>

                    <div className="flex items-center gap-1 text-[10px] text-stone-400 mt-1">
                      <Clock className="w-3 h-3" />
                      {formattedDate} WITA
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ================= TAB 3: STATISTIK PENGUNJUNG ================= */}
      {activeTab === 'analytics' && (
        <div className="space-y-6 animate-fade-in">
          {/* Baris Kartu Angka Utama */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Total Kunjungan */}
            <div className="bg-white p-6 rounded-3xl border border-stone-200 shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-bold text-stone-400 uppercase tracking-wider">
                  Total Pengunjung
                </span>
                <div className="w-10 h-10 rounded-2xl bg-rose-50 text-[#DA6868] flex items-center justify-center">
                  <Users className="w-5 h-5" />
                </div>
              </div>
              <div>
                <h3 className="text-3xl font-extrabold text-[#DA6868]">
                  {isLoadingVisitors ? (
                    <span className="text-sm font-normal text-stone-400">Memuat...</span>
                  ) : (
                    visitorCount.toLocaleString('id-ID')
                  )}
                </h3>
                <p className="text-[11px] text-stone-500 mt-1">Tautan web dibuka oleh pengunjung</p>
              </div>
            </div>

            {/* Target Uji Coba Beta (Bisa Diatur Langsung) */}
            <div className="bg-white p-6 rounded-3xl border border-stone-200 shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-stone-400 uppercase tracking-wider">
                  Target Sesi Beta
                </span>
                <div className="flex items-center gap-1.5">
                  {!isEditingTarget && (
                    <button
                      onClick={() => {
                        setInputTarget(betaTarget.toString());
                        setIsEditingTarget(true);
                      }}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#DA6868] bg-rose-50 px-2 py-0.5 rounded-lg hover:bg-rose-100 transition"
                      title="Ubah Target"
                    >
                      <Pencil className="w-3 h-3" />
                      Ubah
                    </button>
                  )}
                  <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                    <Sparkles className="w-4 h-4" />
                  </div>
                </div>
              </div>

              <div>
                {isEditingTarget ? (
                  <form onSubmit={handleSaveTarget} className="flex items-center gap-1.5 mb-2">
                    <input
                      type="number"
                      min="1"
                      value={inputTarget}
                      onChange={(e) => setInputTarget(e.target.value)}
                      className="w-24 px-2.5 py-1 text-sm font-bold border border-stone-300 rounded-xl focus:outline-none focus:border-[#DA6868]"
                      autoFocus
                    />
                    <button
                      type="submit"
                      disabled={isSavingTarget}
                      className="p-1.5 bg-[#DA6868] text-white rounded-lg hover:bg-[#c85656] transition"
                      title="Simpan"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsEditingTarget(false)}
                      className="p-1.5 bg-stone-200 text-stone-600 rounded-lg hover:bg-stone-300 transition"
                      title="Batal"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </form>
                ) : (
                  <h3 className="text-3xl font-extrabold text-stone-800">
                    {betaTarget} <span className="text-xs font-semibold text-stone-400">Sesi Target</span>
                  </h3>
                )}

                {/* Bar Progres Dinamis */}
                <div className="w-full bg-stone-100 h-2 rounded-full overflow-hidden mt-3">
                  <div
                    className="bg-amber-500 h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.min(100, Math.round((visitorCount / (betaTarget || 1)) * 100))}%`,
                    }}
                  />
                </div>
                <p className="text-[10px] text-stone-400 mt-1.5">
                  Progres: {Math.min(100, Math.round((visitorCount / (betaTarget || 1)) * 100))}% dari target
                </p>
              </div>
            </div>

            {/* Status Server */}
            <div className="bg-white p-6 rounded-3xl border border-stone-200 shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-bold text-stone-400 uppercase tracking-wider">
                  Status Server
                </span>
                <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <Activity className="w-5 h-5" />
                </div>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  <h3 className="text-lg font-bold text-emerald-700">Online & Stabil</h3>
                </div>
                <p className="text-[11px] text-stone-500 mt-1">Firebase Firestore & Cloudinary Aktif</p>
              </div>
            </div>
          </div>

          {/* Kotak Informasi Tambahan */}
          <div className="bg-white p-6 rounded-3xl border border-stone-200 shadow-sm">
            <h4 className="text-sm font-bold text-stone-800 mb-2 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-[#DA6868]" />
              Tentang Pencatatan Pengunjung
            </h4>
            <p className="text-xs text-stone-500 leading-relaxed mb-3">
              Setiap kali seseorang membuka halaman utama web Dekatan di perangkat HP atau laptop, sistem akan menambahkan 1 hitungan ke Firestore (<code className="bg-stone-100 px-1.5 py-0.5 rounded text-stone-700">stats/visitors</code>).
            </p>
            <div className="p-3 bg-stone-50 rounded-2xl border border-stone-200 text-[11px] text-stone-600">
              💡 <strong>Catatan:</strong> Tombol <strong>Ubah</strong> di kartu target memungkinkan kamu menaikkan kuota uji coba (misal: 100 atau 200) kapan saja tanpa harus mengubah kode pemrograman.
            </div>
          </div>
        </div>
      )}
    </main>
  );
}