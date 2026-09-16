'use client';

import React, { useState } from 'react';
import { MessageSquarePlus, X, Send, CheckCircle2 } from 'lucide-react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export default function FeedbackButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState('');
  const [category, setCategory] = useState<'Kritik & Saran' | 'Laporan Kendala' | 'Fitur Baru'>('Kritik & Saran');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;

    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'feedbacks'), {
        name: name.trim() || 'Anonim',
        category,
        message: message.trim(),
        createdAt: serverTimestamp(),
      });

      setIsSuccess(true);
      setMessage('');
      setName('');
      setTimeout(() => {
        setIsSuccess(false);
        setIsOpen(false);
      }, 2000);
    } catch (err) {
      console.error('Gagal mengirim masukan:', err);
      alert('Gagal mengirim pesan. Pastikan koneksi internet stabil.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      {/* Tombol Mengambang (Floating Action Button) */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-5 right-5 z-40 bg-[#DA6868] text-white p-3.5 rounded-full shadow-xl hover:bg-[#c85656] active:scale-95 touch-manipulation flex items-center gap-2 transition-all duration-200"
        title="Beri Masukan / Laporkan Kendala"
      >
        <MessageSquarePlus className="w-5 h-5" />
        <span className="text-xs font-semibold pr-1 hidden sm:inline">Pesan & Masukan</span>
      </button>

      {/* Modal / Dialog Pop-up */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-fade-in">
          <div className="bg-white w-full max-w-sm rounded-3xl p-5 md:p-6 shadow-2xl border border-stone-200 relative">
            <button
              onClick={() => setIsOpen(false)}
              className="absolute top-4 right-4 text-stone-400 hover:text-stone-700 p-1 rounded-full transition"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-base font-bold text-stone-800 mb-1 flex items-center gap-2">
              <MessageSquarePlus className="w-4 h-4 text-[#DA6868]" />
              Kotak Masukan
            </h3>
            <p className="text-xs text-stone-500 mb-4">
              Ada kendala, ide bingkai baru, atau pesan untuk pengembang? Tulis di bawah ini.
            </p>

            {isSuccess ? (
              <div className="py-8 flex flex-col items-center text-center animate-fade-in">
                <CheckCircle2 className="w-12 h-12 text-emerald-500 mb-2" />
                <p className="text-sm font-semibold text-stone-700">Terima kasih atas masukannya!</p>
                <p className="text-xs text-stone-400 mt-1">Pesanmu sudah terkirim ke dashboard pengembang.</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="flex flex-col gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-stone-600 mb-1">
                    Nama / Panggilan (Opsional):
                  </label>
                  <input
                    type="text"
                    maxLength={30}
                    placeholder="Contoh: Pengunjung Dekatan"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-stone-200 focus:outline-none focus:border-[#DA6868] text-stone-700"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-stone-600 mb-1">
                    Kategori Pesan:
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as any)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-stone-200 focus:outline-none focus:border-[#DA6868] text-stone-700 bg-white"
                  >
                    <option value="Kritik & Saran">Kritik & Saran</option>
                    <option value="Laporan Kendala">Laporan Kendala (Bug/Error)</option>
                    <option value="Fitur Baru">Ide / Permintaan Fitur</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-stone-600 mb-1">
                    Isi Pesan Masukan:
                  </label>
                  <textarea
                    rows={4}
                    maxLength={300}
                    required
                    placeholder="Tuliskan pengalaman atau kendala yang kamu temukan..."
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-stone-200 focus:outline-none focus:border-[#DA6868] text-stone-700 resize-none"
                  />
                  <div className="text-right text-[10px] text-stone-400 mt-0.5">
                    {message.length}/300
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting || !message.trim()}
                  className="w-full py-2.5 bg-[#DA6868] text-white font-semibold text-xs rounded-xl shadow-md hover:bg-[#c85656] disabled:opacity-50 active:scale-95 touch-manipulation flex items-center justify-center gap-1.5 transition"
                >
                  <Send className="w-3.5 h-3.5" />
                  {isSubmitting ? 'Mengirim...' : 'Kirim Masukan'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}