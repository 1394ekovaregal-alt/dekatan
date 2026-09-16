'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, Trash2, ShieldLock, Inbox, Clock, RefreshCw } from 'lucide-react';
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  doc,
  deleteDoc,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';

interface FeedbackItem {
  id: string;
  name: string;
  category: string;
  message: string;
  createdAt: any;
}

export default function AdminFeedbackPage() {
  const [pin, setPin] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [feedbacks, setFeedbacks] = useState<FeedbackItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Verifikasi PIN Sederhana
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

    setIsLoading(true);
    const q = query(collection(db, 'feedbacks'), orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const items: FeedbackItem[] = [];
        snapshot.forEach((docSnap) => {
          items.push({ id: docSnap.id, ...(docSnap.data() as any) });
        });
        setFeedbacks(items);
        setIsLoading(false);
      },
      (error) => {
        console.error('Firestore snapshot error:', error);
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [isAuthenticated]);

  const handleDelete = async (id: string) => {
    if (!confirm('Hapus pesan masukan ini?')) return;
    try {
      await deleteDoc(doc(db, 'feedbacks', id));
    } catch (err) {
      console.error('Gagal menghapus pesan:', err);
    }
  };

  if (!isAuthenticated) {
    return (
      <main className="min-h-screen bg-[#FAF7F2] flex items-center justify-center px-4">
        <div className="bg-white w-full max-w-xs p-6 rounded-3xl shadow-xl border border-stone-200 text-center">
          <div className="w-12 h-12 bg-rose-50 text-[#DA6868] rounded-2xl flex items-center justify-center mx-auto mb-3">
            <ShieldLock className="w-6 h-6" />
          </div>
          <h2 className="text-base font-bold text-stone-800">Masuk Dashboard Admin</h2>
          <p className="text-xs text-stone-500 mb-4 mt-0.5">Masukkan PIN untuk membuka pesan pengunjung.</p>

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
              Buka Kotak Masukan
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
    <main className="min-h-screen bg-[#FAF7F2] px-4 py-6 md:py-10 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs md:text-sm font-medium text-slate-600 hover:text-[#DA6868] transition"
        >
          <ArrowLeft className="w-4 h-4" />
          Beranda
        </Link>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-[#DA6868] bg-rose-50 px-3 py-1 rounded-full border border-rose-100">
            {feedbacks.length} Masukan Diterima
          </span>
        </div>
      </div>

      <div className="bg-white rounded-3xl p-5 md:p-6 shadow-sm border border-stone-200">
        <h1 className="text-lg font-bold text-stone-800 mb-1 flex items-center gap-2">
          <Inbox className="w-5 h-5 text-[#DA6868]" />
          Daftar Masukan & Kritik Pengunjung
        </h1>
        <p className="text-xs text-stone-500 mb-5">
          Pesan tersinkronisasi secara otomatis begitu pengunjung mengirimkan masukan.
        </p>

        {isLoading ? (
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
                      onClick={() => handleDelete(item.id)}
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
    </main>
  );
}