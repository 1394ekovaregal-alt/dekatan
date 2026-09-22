'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Camera, Gamepad2, Tv, Sparkles } from 'lucide-react';
import { doc, setDoc, increment } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export default function Home() {
  useEffect(() => {
    // Gunakan sessionStorage agar refresh halaman tidak dihitung berulang kali
    const hasVisited = sessionStorage.getItem('visited_dekatan');
    if (!hasVisited) {
      setDoc(doc(db, 'stats', 'visitors'), { total: increment(1) }, { merge: true })
        .then(() => sessionStorage.setItem('visited_dekatan', 'true'))
        .catch((err) => console.error('Gagal mencatat kunjungan:', err));
    }
  }, []);

  return (
    <div className="min-h-screen bg-[#FAF7F2] flex flex-col justify-between">
      {/* Header Navigasi */}
      <header className="w-full max-w-6xl mx-auto px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-4">
        <Link href="/" className="flex items-center">
          <div className="relative w-36 h-10 shrink-0">
            <Image
              src="/dekatan1.png"
              alt="Dekatan"
              fill
              className="object-contain"
              priority
            />
          </div>
        </Link>

        <p className="text-sm font-medium italic text-[#264653]/70">
          “Jauh di mata, dekat di frame.”
        </p>

        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#DA6868]/10 border border-[#DA6868]/30 text-[#DA6868] text-xs font-semibold shadow-xs">
          <Sparkles className="w-3.5 h-3.5" />
          <span>🔥 Uji Coba Terbatas</span>
        </div>
      </header>

      {/* Main Section */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-12 flex flex-col justify-center">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[#264653] mb-4">
            Abadikan Rindu, Ciptakan Kenangan Bersama
          </h1>
          <p className="text-base sm:text-lg text-[#264653]/80 leading-relaxed">
            Ruang virtual interaktif dan photobooth khusus pasangan jarak jauh untuk melepas rindu dengan cara paling berkesan. Pilih aktivitas favorit kalian di bawah untuk memulai momen spesial hari ini.
          </p>
        </div>

        {/* Grid 3 Menu Aktivitas */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Kartu 1: Dekat Photobooth (AKTIF) */}
          <div className="relative bg-white rounded-2xl p-6 shadow-sm hover:shadow-md transition-all duration-300 border border-[#DA6868]/30 flex flex-col justify-between group">
            <div className="absolute top-4 right-4">
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-[#DA6868] text-white shadow-xs">
                AKTIF
              </span>
            </div>

            <div>
              <div className="w-12 h-12 rounded-xl bg-[#DA6868]/10 text-[#DA6868] flex items-center justify-center mb-5 group-hover:scale-110 transition-transform duration-300">
                <Camera className="w-6 h-6" />
              </div>
              <h2 className="text-xl font-bold text-[#264653] mb-2">
                Dekat Photobooth
              </h2>
              <p className="text-sm text-[#264653]/70 leading-relaxed mb-6">
                Abadikan momen manis sendiri atau bareng pasangan secara virtual, cetak strip foto estetik langsung.
              </p>
            </div>

            <div className="space-y-3 pt-4 border-t border-gray-100">
              <Link
                href="/photobooth/solo"
                className="w-full flex items-center justify-center py-2.5 px-4 rounded-xl bg-[#DA6868] hover:bg-[#c55555] text-white text-sm font-semibold transition-colors shadow-xs"
              >
                Mode Sendiri
              </Link>
              <Link
                href="/photobooth/duo"
                className="w-full flex items-center justify-center py-2.5 px-4 rounded-xl bg-[#264653] hover:bg-[#1e3741] text-white text-sm font-semibold transition-colors shadow-xs"
              >
                Mode Berdua
              </Link>
            </div>
          </div>

          {/* Kartu 2: Dekat Game (COMING SOON) */}
          <div className="relative bg-white/75 backdrop-blur-xs rounded-2xl p-6 shadow-sm border border-[#264653]/10 flex flex-col justify-between opacity-60">
            <div className="absolute top-4 right-4">
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-[#264653]/10 text-[#264653]">
                Segera Hadir
              </span>
            </div>

            <div>
              <div className="w-12 h-12 rounded-xl bg-[#264653]/10 text-[#264653] flex items-center justify-center mb-5">
                <Gamepad2 className="w-6 h-6" />
              </div>
              <h2 className="text-xl font-bold text-[#264653] mb-2">
                Dekat Game
              </h2>
              <p className="text-sm text-[#264653]/70 leading-relaxed mb-6">
                Susun puzzle dari potongan foto berdua dan mainkan kartu obrolan Deep Talk untuk obrolan makin intim.
              </p>
            </div>

            <div className="pt-4 border-t border-gray-100">
              <button
                disabled
                className="w-full py-2.5 px-4 rounded-xl bg-gray-200 text-gray-500 text-sm font-semibold cursor-not-allowed"
              >
                Segera Hadir
              </button>
            </div>
          </div>

          {/* Kartu 3: Dekat Nobar (COMING SOON) */}
          <div className="relative bg-white/75 backdrop-blur-xs rounded-2xl p-6 shadow-sm border border-[#264653]/10 flex flex-col justify-between opacity-60">
            <div className="absolute top-4 right-4">
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-[#264653]/10 text-[#264653]">
                Segera Hadir
              </span>
            </div>

            <div>
              <div className="w-12 h-12 rounded-xl bg-[#264653]/10 text-[#264653] flex items-center justify-center mb-5">
                <Tv className="w-6 h-6" />
              </div>
              <h2 className="text-xl font-bold text-[#264653] mb-2">
                Dekat Nobar
              </h2>
              <p className="text-sm text-[#264653]/70 leading-relaxed mb-6">
                Nonton video YouTube dan klip kenangan bersama secara sinkron sambil tatap muka virtual tanpa jeda.
              </p>
            </div>

            <div className="pt-4 border-t border-gray-100">
              <button
                disabled
                className="w-full py-2.5 px-4 rounded-xl bg-gray-200 text-gray-500 text-sm font-semibold cursor-not-allowed"
              >
                Segera Hadir
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full max-w-6xl mx-auto px-6 py-6 text-center border-t border-[#264653]/10 text-xs text-[#264653]/60 flex items-center justify-center gap-1.5">
        <span>Solusi Quality time untuk pejuang LDR</span>
        <span>• © 2026 Dekatan</span>
      </footer>
    </div>
  );
}
