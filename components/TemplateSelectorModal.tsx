'use client';

import React, { useState } from 'react';
import { X, Check, Sparkles, Rows, LayoutGrid } from 'lucide-react';

export type LayoutMode = 'strip3' | 'strip4' | 'grid';
export type SlotShape = 'rect' | 'arch' | 'heart' | 'rounded';

export interface FrameTemplate {
  id: string;
  name: string;
  category: 'retro' | 'love' | 'cute' | 'minimal';
  bg: string;
  border: string;
  slotBorder: string;
  textColor: string;
  subTextColor: string;
  slotShape: SlotShape;
  pattern?: 'film' | 'none';
  labelFooter: string;
}

export const FRAME_TEMPLATES: FrameTemplate[] = [
  // RETRO & FILM
  {
    id: 'retro-film-noir',
    name: 'Film Roll Noir',
    category: 'retro',
    bg: '#18181B',
    border: '#27272A',
    slotBorder: '#3F3F46',
    textColor: '#FAF7F2',
    subTextColor: '#A1A1AA',
    slotShape: 'rect',
    pattern: 'film',
    labelFooter: 'DEKATAN FILM • 35MM',
  },
  {
    id: 'retro-classic-arch',
    name: 'Classic Arch',
    category: 'retro',
    bg: '#232931',
    border: '#393E46',
    slotBorder: '#4E545C',
    textColor: '#EEEEEE',
    subTextColor: '#9DA5B4',
    slotShape: 'arch',
    labelFooter: 'ARCHIVE MOMENTS',
  },
  {
    id: 'retro-vintage-paper',
    name: 'Vintage Paper',
    category: 'retro',
    bg: '#EFE6D5',
    border: '#DFD2BC',
    slotBorder: '#C9B99E',
    textColor: '#4A3728',
    subTextColor: '#7C6A59',
    slotShape: 'rounded',
    labelFooter: 'MEMORIES • 2026',
  },

  // AESTHETIC LOVE
  {
    id: 'love-sweet-hearts',
    name: 'Sweet Hearts',
    category: 'love',
    bg: '#FCE7F3',
    border: '#FBCFE8',
    slotBorder: '#F472B6',
    textColor: '#BE185D',
    subTextColor: '#DB2777',
    slotShape: 'heart',
    labelFooter: 'FOREVER WITH U',
  },
  {
    id: 'love-wine-romance',
    name: 'Wine Romance',
    category: 'love',
    bg: '#450A0A',
    border: '#7F1D1D',
    slotBorder: '#991B1B',
    textColor: '#FECDD3',
    subTextColor: '#FDA4AF',
    slotShape: 'heart',
    labelFooter: 'DEKATAN LOVE STORY',
  },
  {
    id: 'love-pastel-arch',
    name: 'Blue Sky Arch',
    category: 'love',
    bg: '#E0F2FE',
    border: '#BAE6FD',
    slotBorder: '#7DD3FC',
    textColor: '#0369A1',
    subTextColor: '#0284C7',
    slotShape: 'arch',
    labelFooter: 'UNDER THE SAME SKY',
  },

  // CUTE & FUN
  {
    id: 'cute-coral-blush',
    name: 'Coral Dekatan',
    category: 'cute',
    bg: '#DA6868',
    border: '#C85656',
    slotBorder: '#FFE4E6',
    textColor: '#FFFFFF',
    subTextColor: '#FECDD3',
    slotShape: 'rounded',
    labelFooter: 'DEKATAN PHOTOBOOTH',
  },
  {
    id: 'cute-butter-yellow',
    name: 'Sunny Butter',
    category: 'cute',
    bg: '#FEF08A',
    border: '#FDE047',
    slotBorder: '#FACC15',
    textColor: '#854D0E',
    subTextColor: '#A16207',
    slotShape: 'rounded',
    labelFooter: 'CHEESE & SMILE! ✨',
  },
  {
    id: 'cute-soft-lavender',
    name: 'Lavender Heart',
    category: 'cute',
    bg: '#EDE9FE',
    border: '#DDD6FE',
    slotBorder: '#C4B5FD',
    textColor: '#5B21B6',
    subTextColor: '#7C3AED',
    slotShape: 'heart',
    labelFooter: 'LOVELY DAY WITH YOU',
  },

  // MINIMALIS
  {
    id: 'minimal-pure-white',
    name: 'Clean White',
    category: 'minimal',
    bg: '#FFFFFF',
    border: '#F1F5F9',
    slotBorder: '#E2E8F0',
    textColor: '#1E293B',
    subTextColor: '#64748B',
    slotShape: 'rect',
    labelFooter: 'DEKATAN STUDIO',
  },
  {
    id: 'minimal-warm-cream',
    name: 'Warm Cream',
    category: 'minimal',
    bg: '#FAF7F2',
    border: '#E7E5E4',
    slotBorder: '#D6D3D1',
    textColor: '#44403C',
    subTextColor: '#78716C',
    slotShape: 'rect',
    labelFooter: 'TIMELESS MEMORIES',
  },
  {
    id: 'minimal-deep-slate',
    name: 'Midnight Slate',
    category: 'minimal',
    bg: '#0F172A',
    border: '#1E293B',
    slotBorder: '#334155',
    textColor: '#F8FAFC',
    subTextColor: '#94A3B8',
    slotShape: 'rect',
    labelFooter: 'EDISI MONOKROM',
  },
];

interface TemplateSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedTemplateId: string;
  selectedLayout: LayoutMode;
  onSelectLayout: (layout: LayoutMode) => void;
  onSelectTemplate: (template: FrameTemplate) => void;
}

export default function TemplateSelectorModal({
  isOpen,
  onClose,
  selectedTemplateId,
  selectedLayout,
  onSelectLayout,
  onSelectTemplate,
}: TemplateSelectorModalProps) {
  const [activeCategory, setActiveCategory] = useState<string>('all');

  if (!isOpen) return null;

  const categories = [
    { id: 'all', label: 'Semua Seri' },
    { id: 'retro', label: 'Retro & Film' },
    { id: 'love', label: 'Aesthetic Love' },
    { id: 'cute', label: 'Cute & Fun' },
    { id: 'minimal', label: 'Minimalis' },
  ];

  const filtered = FRAME_TEMPLATES.filter(
    (t) => activeCategory === 'all' || t.category === activeCategory
  );

  const slotCount = selectedLayout === 'strip3' ? 3 : 4;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4 animate-fade-in">
      <div className="bg-[#FAF7F2] w-full max-w-md h-[90vh] sm:h-[85vh] sm:max-h-[720px] rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-stone-200">
        
        {/* Header Modal */}
        <div className="p-4 bg-white border-b border-stone-200 flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-base font-bold text-stone-800 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-[#DA6868]" />
              Katalog Frame
            </h2>
            <p className="text-[11px] text-stone-500">Pilih tata letak dan tema visual favoritmu.</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-stone-100 text-stone-400 hover:text-stone-700 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 1. Pengalih Tata Letak (Strip 1x3, 1x4, Grid 2x2) */}
        <div className="px-4 pt-3 pb-1 bg-white shrink-0">
          <div className="bg-stone-100 p-1 rounded-2xl flex gap-1">
            <button
              onClick={() => onSelectLayout('strip3')}
              className={`flex-1 py-1.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1 transition ${
                selectedLayout === 'strip3'
                  ? 'bg-[#DA6868] text-white shadow-xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              <Rows className="w-3.5 h-3.5" />
              Strip (1×3)
            </button>
            <button
              onClick={() => onSelectLayout('strip4')}
              className={`flex-1 py-1.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1 transition ${
                selectedLayout === 'strip4'
                  ? 'bg-[#DA6868] text-white shadow-xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              <Rows className="w-3.5 h-3.5" />
              Strip (1×4)
            </button>
            <button
              onClick={() => onSelectLayout('grid')}
              className={`flex-1 py-1.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1 transition ${
                selectedLayout === 'grid'
                  ? 'bg-[#DA6868] text-white shadow-xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              Grid (2×2)
            </button>
          </div>
        </div>

        {/* 2. Kategori Geser Menyamping */}
        <div className="px-4 py-2.5 bg-white border-b border-stone-200 overflow-x-auto no-scrollbar flex items-center gap-1.5 shrink-0">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
                activeCategory === cat.id
                  ? 'bg-rose-100 text-[#DA6868] font-bold border border-rose-200'
                  : 'bg-stone-100 text-stone-600 hover:bg-stone-200 border border-transparent'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* 3. Katalog Grid 3-Kolom ala Fremio */}
        <div className="flex-1 overflow-y-auto p-4 touch-pan-y">
          <div className="grid grid-cols-3 gap-3">
            {filtered.map((tpl) => {
              const isSelected = selectedTemplateId === tpl.id;

              return (
                <button
                  key={tpl.id}
                  onClick={() => {
                    onSelectTemplate(tpl);
                    onClose();
                  }}
                  className={`flex flex-col items-center group relative rounded-2xl p-1.5 transition-all text-left ${
                    isSelected
                      ? 'ring-2 ring-[#DA6868] bg-rose-50/60 shadow-md'
                      : 'hover:bg-white/90'
                  }`}
                >
                  <div
                    className="w-full aspect-[9/22] rounded-xl shadow-xs border p-2 flex flex-col justify-between transition-transform group-hover:scale-[1.02] relative overflow-hidden"
                    style={{
                      backgroundColor: tpl.bg,
                      borderColor: tpl.border,
                    }}
                  >
                    {tpl.pattern === 'film' && (
                      <div className="absolute top-0 bottom-0 left-0.5 flex flex-col justify-between py-1 pointer-events-none">
                        {[...Array(6)].map((_, i) => (
                          <div key={i} className="w-1 h-1.5 bg-white/30 rounded-xs mb-1" />
                        ))}
                      </div>
                    )}

                    <div
                      className={`w-full flex-1 flex ${
                        selectedLayout === 'grid' ? 'grid grid-cols-2 gap-1' : 'flex-col gap-1.5'
                      } justify-center`}
                    >
                      {[...Array(slotCount)].map((_, idx) => (
                        <div
                          key={idx}
                          className={`w-full bg-[#DAE2F8]/80 border flex items-center justify-center shadow-inner ${
                            tpl.slotShape === 'arch'
                              ? 'rounded-t-full rounded-b-xs aspect-[3/4]'
                              : tpl.slotShape === 'heart'
                              ? 'rounded-2xl aspect-[3/4] scale-95'
                              : tpl.slotShape === 'rounded'
                              ? 'rounded-md aspect-[3/4]'
                              : 'rounded-xs aspect-[3/4]'
                          }`}
                          style={{ borderColor: tpl.slotBorder }}
                        >
                          <span className="text-[8px] font-mono text-[#5B6B92] font-semibold">
                            {idx + 1}
                          </span>
                        </div>
                      ))}
                    </div>

                    <div className="mt-2 text-center shrink-0">
                      <span
                        className="text-[7px] font-bold tracking-wider uppercase block truncate"
                        style={{ color: tpl.textColor }}
                      >
                        {tpl.labelFooter}
                      </span>
                    </div>

                    {isSelected && (
                      <div className="absolute top-1 right-1 bg-[#DA6868] text-white p-0.5 rounded-full shadow-md">
                        <Check className="w-2.5 h-2.5 stroke-[3]" />
                      </div>
                    )}
                  </div>

                  <span className="text-[11px] font-semibold text-stone-700 mt-1.5 text-center line-clamp-1">
                    {tpl.name}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="p-3 bg-white border-t border-stone-200 text-center shrink-0">
          <p className="text-[10px] text-stone-400">
            Ketuk salah satu kartu desain untuk menerapkannya ke bilik foto.
          </p>
        </div>
      </div>
    </div>
  );
}