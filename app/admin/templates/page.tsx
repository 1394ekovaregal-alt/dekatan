'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  UploadCloud,
  Trash2,
  ShieldLock,
  Layers,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  doc,
  deleteDoc,
  addDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';

// Ganti nilai dua variabel ini sesuai akun Cloudinary milikmu:
const CLOUDINARY_CLOUD_NAME = 'cx9rcd4t';
const CLOUDINARY_UPLOAD_PRESET = 'dekatan_template';

interface CustomTemplate {
  id: string;
  name: string;
  category: 'retro' | 'love' | 'cute' | 'minimal';
  format: 'strip3' | 'strip4' | 'grid';
  overlayUrl: string;
  isDark: boolean;
  createdAt: any;
}

export default function AdminTemplatesPage() {
  const [pin, setPin] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [templates, setTemplates] = useState<CustomTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Form State
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

  useEffect(() => {
    if (!isAuthenticated) return;

    const q = query(collection(db, 'templates'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const items: CustomTemplate[] = [];
        snapshot.forEach((docSnap) => {
          items.push({ id: docSnap.id, ...(docSnap.data() as any) });
        });
        setTemplates(items);
        setIsLoading(false);
      },
      (err) => {
        console.error('Gagal mengambil template:', err);
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [isAuthenticated]);

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

  const handleUploadTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !selectedFile) {
      alert('Nama dan berkas gambar wajib diisi.');
      return;
    }

    setStatusMsg(null);
    setUploadProgress(20);

    try {
      // 1. Unggah berkas ke Cloudinary API
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

      // 2. Simpan URL Cloudinary dan metadata ke Firestore
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

  const handleDelete = async (id: string) => {
    if (!confirm('Hapus template ini dari katalog bilik foto?')) return;
    try {
      await deleteDoc(doc(db, 'templates', id));
    } catch (err) {
      console.error('Gagal menghapus:', err);
    }
  };

  if (!isAuthenticated) {
    return (
      <main className="min-h-screen bg-[#FAF7F2] flex items-center justify-center px-4">
        <div className="bg-white w-full max-w-xs p-6 rounded-3xl shadow-xl border border-stone-200 text-center">
          <div className="w-12 h-12 bg-rose-50 text-[#DA6868] rounded-2xl flex items-center justify-center mx-auto mb-3">
            <ShieldLock className="w-6 h-6" />
          </div>
          <h2 className="text-base font-bold text-stone-800">Manajemen Template</h2>
          <p className="text-xs text-stone-500 mb-4 mt-0.5">
            Masukkan PIN Admin untuk mengunggah desain bingkai.
          </p>

          <form onSubmit={handleLogin} className="flex flex-col gap-3">
            <input
              type="password"
              maxLength={6}
              placeholder="PIN Admin"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              className="w-full text-center px-4 py-2.5 rounded-xl border border-stone-300 text-sm font-mono tracking-widest focus:outline-none focus:border-[#DA6868]"
            />
            <button
              type="submit"
              className="w-full py-2.5 bg-[#DA6868] text-white font-semibold text-xs rounded-xl shadow-md hover:bg-[#c85656] transition"
            >
              Buka Panel
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
    <main className="min-h-screen bg-[#FAF7F2] px-4 py-6 md:py-10 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs md:text-sm font-medium text-slate-600 hover:text-[#DA6868] transition"
        >
          <ArrowLeft className="w-4 h-4" />
          Beranda
        </Link>
        <Link
          href="/admin/feedback"
          className="text-xs font-semibold text-[#DA6868] bg-rose-50 px-3 py-1.5 rounded-full border border-rose-100 hover:bg-rose-100 transition"
        >
          Lihat Kotak Masukan →
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
        {/* Formulir Unggah Template */}
        <div className="md:col-span-2 bg-white p-5 rounded-3xl shadow-sm border border-stone-200 h-fit">
          <h2 className="text-base font-bold text-stone-800 mb-1 flex items-center gap-2">
            <UploadCloud className="w-5 h-5 text-[#DA6868]" />
            Tambah Frame PNG
          </h2>
          <p className="text-[11px] text-stone-500 mb-4">
            Pastikan lubang tempat foto transparan agar foto pengguna bisa terlihat.
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

            <div className="flex items-center gap-2 p-2 rounded-xl bg-stone-50 border border-stone-200">
              <input
                type="checkbox"
                id="isDarkCheck"
                checked={isDark}
                onChange={(e) => setIsDark(e.target.checked)}
                className="w-4 h-4 accent-[#DA6868] rounded"
              />
              <label htmlFor="isDarkCheck" className="text-xs text-stone-700 font-medium cursor-pointer">
                Desain bernuansa gelap (otomatis logo & teks putih)
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
                Template di bawah ini langsung muncul di katalog bilik foto pengguna.
              </p>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 bg-stone-100 rounded-full text-stone-600">
              {templates.length} Desain
            </span>
          </div>

          {isLoading ? (
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
                    onClick={() => handleDelete(item.id)}
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
    </main>
  );
}