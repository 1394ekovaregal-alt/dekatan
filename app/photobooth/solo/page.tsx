'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  Camera,
  RefreshCw,
  Download,
  ArrowLeft,
  Sparkles,
  LayoutGrid,
  Rows,
  Smile,
  SlidersHorizontal,
  X,
  Maximize2,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';

const FRAME_THEMES = {
  white: {
    name: 'Putih Bersih',
    bg: '#FFFFFF',
    subText: '#64748B',
    editionText: '#94A3B8',
    border: '#F1F5F9',
    divider: '#F1F5F9',
    swatchBorder: '#E2E8F0',
  },
  black: {
    name: 'Hitam Retro',
    bg: '#18181B',
    subText: '#A1A1AA',
    editionText: '#71717A',
    border: '#27272A',
    divider: '#27272A',
    swatchBorder: '#18181B',
  },
  cream: {
    name: 'Krem Hangat',
    bg: '#FAF7F2',
    subText: '#78716C',
    editionText: '#A8A29E',
    border: '#E7E5E4',
    divider: '#E7E5E4',
    swatchBorder: '#D6D3D1',
  },
  coral: {
    name: 'Coral Dekatan',
    bg: '#DA6868',
    subText: '#FFE4E6',
    editionText: '#FECDD3',
    border: '#E57373',
    divider: '#E57373',
    swatchBorder: '#DA6868',
  },
};

type FrameThemeKey = keyof typeof FRAME_THEMES;

const PHOTO_FILTERS = {
  normal: { name: 'Asli', filter: 'none' },
  bw: { name: 'Monochrome', filter: 'grayscale(100%) contrast(115%)' },
  vintage: { name: 'Retro Film', filter: 'sepia(35%) contrast(105%) brightness(95%) saturate(85%)' },
  warm: { name: 'Warm Soft', filter: 'sepia(15%) saturate(125%) brightness(105%) contrast(95%)' },
} as const;

type PhotoFilterKey = keyof typeof PHOTO_FILTERS;
type LayoutMode = 'strip4' | 'strip3' | 'grid';

const AVAILABLE_STICKERS = [
  '❤️', '💖', '✨', '🎀', '🧸', '🌸',
  '👑', '⭐', '💌', '🐱', '🍒', '🍓',
  '☁️', '🔥', '😎', '🍀', '🌼', '🎂',
];

interface PlacedSticker {
  id: string;
  emoji: string;
  x: number; // Persentase koordinat horizontal (0 - 100%)
  y: number; // Persentase koordinat vertikal (0 - 100%)
  scale: number; // Faktor skala ukuran (0.6 - 2.5)
}

export default function SoloPhotobooth() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const previewContainerRef = useRef<HTMLDivElement | null>(null);

  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [currentShot, setCurrentShot] = useState(0);
  const [capturedPhotos, setCapturedPhotos] = useState<string[]>([]);
  const [finalStripUrl, setFinalStripUrl] = useState<string | null>(null);
  const [isGeneratingStrip, setIsGeneratingStrip] = useState(false);
  const [showFlash, setShowFlash] = useState(false);

  const [selectedTheme, setSelectedTheme] = useState<FrameThemeKey>('white');
  const [selectedFilter, setSelectedFilter] = useState<PhotoFilterKey>('normal');
  const [selectedLayout, setSelectedLayout] = useState<LayoutMode>('strip4');
  const [customNote, setCustomNote] = useState<string>('');

  // Tab & Stiker Interaktif
  const [activeTab, setActiveTab] = useState<'filter' | 'stiker'>('filter');
  const [placedStickers, setPlacedStickers] = useState<PlacedSticker[]>([]);
  const [selectedStickerId, setSelectedStickerId] = useState<string | null>(null);
  const [activeDraggingId, setActiveDraggingId] = useState<string | null>(null);
  const [resizeState, setResizeState] = useState<{
    id: string;
    startX: number;
    startY: number;
    initialScale: number;
  } | null>(null);

  const initAudio = useCallback(() => {
    if (!audioCtxRef.current) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        audioCtxRef.current = new AudioCtx();
      }
    }
    if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume().catch(() => {});
    }
  }, []);

  useEffect(() => {
    const unlockAudio = () => {
      initAudio();
      if (audioCtxRef.current) {
        const osc = audioCtxRef.current.createOscillator();
        const gain = audioCtxRef.current.createGain();
        gain.gain.value = 0.001;
        osc.connect(gain);
        gain.connect(audioCtxRef.current.destination);
        osc.start();
        osc.stop(audioCtxRef.current.currentTime + 0.01);
      }
      window.removeEventListener('click', unlockAudio);
      window.removeEventListener('touchstart', unlockAudio);
    };

    window.addEventListener('click', unlockAudio);
    window.addEventListener('touchstart', unlockAudio);

    return () => {
      window.removeEventListener('click', unlockAudio);
      window.removeEventListener('touchstart', unlockAudio);
    };
  }, [initAudio]);

  const playBeepSound = useCallback(() => {
    try {
      initAudio();
      const ctx = audioCtxRef.current;
      if (!ctx) return;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, ctx.currentTime);

      gain.gain.setValueAtTime(0.5, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.15);
    } catch (e) {
      console.log('Beep audio error:', e);
    }
  }, [initAudio]);

  const playShutterSound = useCallback(() => {
    try {
      initAudio();
      const ctx = audioCtxRef.current;
      if (!ctx) return;

      const bufferSize = Math.floor(ctx.sampleRate * 0.1);
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }

      const noise = ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 1500;

      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(0.6, ctx.currentTime);
      noiseGain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);

      noise.connect(filter);
      filter.connect(noiseGain);
      noiseGain.connect(ctx.destination);
      noise.start();

      const osc = ctx.createOscillator();
      const clickGain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(200, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + 0.05);

      clickGain.gain.setValueAtTime(0.7, ctx.currentTime);
      clickGain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.05);

      osc.connect(clickGain);
      clickGain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.05);
    } catch (e) {
      console.log('Shutter audio error:', e);
    }
  }, [initAudio]);

  const startCamera = useCallback(async () => {
    try {
      setCameraError(null);

      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 960 } },
          audio: false,
        });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
      }

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play().catch((e) => console.log('Autoplay error:', e));
        };
      }
      setCameraReady(true);
    } catch (err: unknown) {
      console.error('Kamera gagal diakses:', err);
      if (err instanceof Error) {
        setCameraError(`${err.name}: ${err.message}`);
      } else {
        setCameraError('Perangkat kamera tidak dapat diakses.');
      }
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraReady(false);
  }, []);

  useEffect(() => {
    startCamera();
    return () => {
      stopCamera();
    };
  }, [startCamera, stopCamera]);

  const captureFrame = (): string => {
    const video = videoRef.current;
    if (!video) return '';

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';

    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    return canvas.toDataURL('image/jpeg', 0.95);
  };

  const generatePhotoStrip = useCallback(
    async (
      photos: string[],
      themeKey: FrameThemeKey = selectedTheme,
      filterKey: PhotoFilterKey = selectedFilter,
      note: string = customNote,
      layout: LayoutMode = selectedLayout,
      stickersToDraw: PlacedSticker[] = placedStickers
    ) => {
      setIsGeneratingStrip(true);

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const theme = FRAME_THEMES[themeKey];
      const isGrid = layout === 'grid';
      const isStrip3 = layout === 'strip3';

      const padding = 32;
      const spacing = 18;
      const footerHeight = note.trim() ? 235 : 195;

      let stripWidth = 560;
      let photoWidth = 0;
      let photoHeight = 0;
      let totalHeight = 0;

      const photoCount = isStrip3 ? 3 : 4;
      const renderPhotos = photos.slice(0, photoCount);

      if (isGrid) {
        stripWidth = 640;
        photoWidth = Math.round((stripWidth - padding * 2 - spacing) / 2);
        photoHeight = Math.round(photoWidth * (4 / 3));
        totalHeight = padding * 2 + photoHeight * 2 + spacing + footerHeight;
      } else if (isStrip3) {
        stripWidth = 560;
        photoWidth = stripWidth - padding * 2;
        photoHeight = Math.round(photoWidth * (4 / 3));
        totalHeight = padding * 2 + photoHeight * 3 + spacing * 2 + footerHeight;
      } else {
        stripWidth = 560;
        photoWidth = stripWidth - padding * 2;
        photoHeight = Math.round(photoWidth * (4 / 3));
        totalHeight = padding * 2 + photoHeight * 4 + spacing * 3 + footerHeight;
      }

      canvas.width = stripWidth;
      canvas.height = totalHeight;

      ctx.fillStyle = theme.bg;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      for (let i = 0; i < renderPhotos.length; i++) {
        const img = new (window as any).Image();
        img.src = renderPhotos[i];
        await new Promise((resolve) => {
          img.onload = resolve;
        });

        let xPos = padding;
        let yPos = padding;

        if (isGrid) {
          const col = i % 2;
          const row = Math.floor(i / 2);
          xPos = padding + col * (photoWidth + spacing);
          yPos = padding + row * (photoHeight + spacing);
        } else {
          yPos = padding + i * (photoHeight + spacing);
        }

        const imgRatio = img.width / img.height;
        const targetRatio = photoWidth / photoHeight;

        let sx = 0;
        let sy = 0;
        let sWidth = img.width;
        let sHeight = img.height;

        if (imgRatio > targetRatio) {
          sWidth = img.height * targetRatio;
          sx = (img.width - sWidth) / 2;
        } else {
          sHeight = img.width / targetRatio;
          sy = (img.height - sHeight) / 2;
        }

        ctx.save();
        ctx.filter = PHOTO_FILTERS[filterKey].filter;
        ctx.drawImage(img, sx, sy, sWidth, sHeight, xPos, yPos, photoWidth, photoHeight);
        ctx.restore();

        ctx.strokeStyle = theme.border;
        ctx.lineWidth = 2;
        ctx.strokeRect(xPos, yPos, photoWidth, photoHeight);
      }

      const footerStartY = totalHeight - footerHeight;

      ctx.strokeStyle = theme.divider;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(padding + 20, footerStartY + 10);
      ctx.lineTo(stripWidth - padding - 20, footerStartY + 10);
      ctx.stroke();

      const logoImg = new (window as any).Image();
      logoImg.src = '/dekatan1.png';
      await new Promise((resolve) => {
        logoImg.onload = resolve;
        logoImg.onerror = resolve;
      });

      const logoWidth = 190;
      const logoHeight = logoImg.naturalHeight
        ? (logoImg.naturalHeight / logoImg.naturalWidth) * logoWidth
        : 52;
      const logoX = (stripWidth - logoWidth) / 2;
      const logoY = footerStartY + 25;

      if (logoImg.complete && logoImg.naturalWidth !== 0) {
        ctx.drawImage(logoImg, logoX, logoY, logoWidth, logoHeight);
      }

      const now = new Date();
      const formattedDate = now.toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
      const formattedTime = now.toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
      });

      let currentTextY = logoY + logoHeight + 24;

      if (note.trim()) {
        ctx.font = '600 15px sans-serif';
        ctx.fillStyle = '#DA6868';
        ctx.textAlign = 'center';
        ctx.fillText(`“${note.trim()}”`, stripWidth / 2, currentTextY);
        currentTextY += 24;
      }

      ctx.font = '500 14px sans-serif';
      ctx.fillStyle = theme.subText;
      ctx.textAlign = 'center';
      ctx.fillText(`${formattedDate} • ${formattedTime} WITA`, stripWidth / 2, currentTextY);

      ctx.font = '12px sans-serif';
      ctx.fillStyle = theme.editionText;
      ctx.fillText(
        isGrid
          ? 'Solo Photobooth • Edisi Grid (2×2)'
          : isStrip3
          ? 'Solo Photobooth • Edisi Strip (1×3)'
          : 'Solo Photobooth • Edisi Strip (1×4)',
        stripWidth / 2,
        currentTextY + 20
      );

      // CETAK STIKER DIGITAL BESERTA SKALA UKURANNYA KE KANVAS
      if (stickersToDraw && stickersToDraw.length > 0) {
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        for (const stk of stickersToDraw) {
          const pixelX = (stk.x / 100) * stripWidth;
          const pixelY = (stk.y / 100) * totalHeight;
          const dynamicFontSize = Math.round(38 * (stk.scale || 1));
          ctx.font = `${dynamicFontSize}px sans-serif`;
          ctx.fillText(stk.emoji, pixelX, pixelY);
        }
      }

      const dataUrl = canvas.toDataURL('image/png');
      setFinalStripUrl(dataUrl);
      setIsGeneratingStrip(false);
      stopCamera();
    },
    [selectedTheme, selectedFilter, customNote, selectedLayout, placedStickers, stopCamera]
  );

  const startPhotoSession = async () => {
    initAudio();
    setIsCapturing(true);
    setCapturedPhotos([]);
    setFinalStripUrl(null);
    setPlacedStickers([]);
    setSelectedStickerId(null);

    const tempPhotos: string[] = [];

    for (let shot = 1; shot <= 4; shot++) {
      setCurrentShot(shot);

      for (let count = 3; count > 0; count--) {
        setCountdown(count);
        playBeepSound();
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      setCountdown(null);
      setShowFlash(true);
      playShutterSound();

      const photoData = captureFrame();
      tempPhotos.push(photoData);
      setCapturedPhotos([...tempPhotos]);
      setTimeout(() => setShowFlash(false), 200);

      if (shot < 4) {
        await new Promise((resolve) => setTimeout(resolve, 1200));
      }
    }

    setIsCapturing(false);
    generatePhotoStrip(tempPhotos, selectedTheme, selectedFilter, customNote, selectedLayout, []);
  };

  const handleThemeChange = (newTheme: FrameThemeKey) => {
    setSelectedTheme(newTheme);
    if (capturedPhotos.length > 0) {
      generatePhotoStrip(capturedPhotos, newTheme, selectedFilter, customNote, selectedLayout, placedStickers);
    }
  };

  const handleFilterChange = (newFilter: PhotoFilterKey) => {
    setSelectedFilter(newFilter);
    if (capturedPhotos.length > 0) {
      generatePhotoStrip(capturedPhotos, selectedTheme, newFilter, customNote, selectedLayout, placedStickers);
    }
  };

  const handleLayoutChange = (newLayout: LayoutMode) => {
    setSelectedLayout(newLayout);
    if (capturedPhotos.length > 0) {
      generatePhotoStrip(capturedPhotos, selectedTheme, selectedFilter, customNote, newLayout, placedStickers);
    }
  };

  const handleNoteChange = (text: string) => {
    setCustomNote(text);
    if (capturedPhotos.length > 0) {
      generatePhotoStrip(capturedPhotos, selectedTheme, selectedFilter, text, selectedLayout, placedStickers);
    }
  };

  // LOGIKA STIKER: TAMBAH, GESER, DAN UBAH UKURAN
  const handleAddSticker = (emoji: string) => {
    const newId = `${Date.now()}-${Math.random().toString(36).substring(2, 5)}`;
    const newSticker: PlacedSticker = {
      id: newId,
      emoji,
      x: 50,
      y: 35 + (placedStickers.length % 4) * 10,
      scale: 1.0,
    };
    const updated = [...placedStickers, newSticker];
    setPlacedStickers(updated);
    setSelectedStickerId(newId);
  };

  const handleRemoveSticker = (id: string, e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    const updated = placedStickers.filter((s) => s.id !== id);
    setPlacedStickers(updated);
    if (selectedStickerId === id) setSelectedStickerId(null);
  };

  // 1. Geser Posisi Stiker
  const handleStickerPointerDown = (e: React.PointerEvent, id: string) => {
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setActiveDraggingId(id);
    setSelectedStickerId(id);
  };

  const handleStickerPointerMove = (e: React.PointerEvent, id: string) => {
    if (activeDraggingId !== id || !previewContainerRef.current) return;
    e.stopPropagation();

    const rect = previewContainerRef.current.getBoundingClientRect();
    const touchX = e.clientX - rect.left;
    const touchY = e.clientY - rect.top;

    const pctX = Math.max(5, Math.min(95, (touchX / rect.width) * 100));
    const pctY = Math.max(5, Math.min(95, (touchY / rect.height) * 100));

    setPlacedStickers((prev) =>
      prev.map((s) => (s.id === id ? { ...s, x: pctX, y: pctY } : s))
    );
  };

  const handleStickerPointerUp = (e: React.PointerEvent) => {
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch (_) {}
    setActiveDraggingId(null);
  };

  // 2. Gagang Sudut Ubah Ukuran (Corner Resize Handle)
  const handleResizeHandleDown = (e: React.PointerEvent, id: string, initialScale: number) => {
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setResizeState({
      id,
      startX: e.clientX,
      startY: e.clientY,
      initialScale: initialScale || 1.0,
    });
    setSelectedStickerId(id);
  };

  const handleResizeHandleMove = (e: React.PointerEvent) => {
    if (!resizeState) return;
    e.stopPropagation();

    const delta = (e.clientX - resizeState.startX) + (e.clientY - resizeState.startY);
    const newScale = Math.max(0.5, Math.min(2.5, Number((resizeState.initialScale + delta * 0.012).toFixed(2))));

    setPlacedStickers((prev) =>
      prev.map((s) => (s.id === resizeState.id ? { ...s, scale: newScale } : s))
    );
  };

  const handleResizeHandleUp = (e: React.PointerEvent) => {
    if (!resizeState) return;
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch (_) {}
    setResizeState(null);
  };

  // 3. Tombol Tambah/Kurang Skala Cepat
  const adjustStickerScale = (id: string, step: number) => {
    setPlacedStickers((prev) =>
      prev.map((s) =>
        s.id === id
          ? { ...s, scale: Math.max(0.5, Math.min(2.5, Number(((s.scale || 1.0) + step).toFixed(2)))) }
          : s
      )
    );
  };

  const handleDownload = async () => {
    if (capturedPhotos.length === 0) return;

    await generatePhotoStrip(
      capturedPhotos,
      selectedTheme,
      selectedFilter,
      customNote,
      selectedLayout,
      placedStickers
    );

    const fileName = `dekatan-solo-${selectedLayout}-${selectedTheme}-${Date.now()}.png`;

    try {
      if (!finalStripUrl) return;
      const response = await fetch(finalStripUrl);
      const blob = await response.blob();
      const file = new File([blob], fileName, { type: 'image/png' });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: 'Foto Strip Dekatan',
          text: 'Strip kenangan dari Dekatan Photobooth ✨',
        });
        return;
      }
    } catch (error) {
      console.log('Web Share dibatalkan:', error);
    }

    if (finalStripUrl) {
      const link = document.createElement('a');
      link.download = fileName;
      link.href = finalStripUrl;
      link.click();
    }
  };

  const handleRetake = () => {
    setFinalStripUrl(null);
    setCapturedPhotos([]);
    setPlacedStickers([]);
    setSelectedStickerId(null);
    setCurrentShot(0);
    startCamera();
  };

  const currentSelectedSticker = placedStickers.find((s) => s.id === selectedStickerId);

  return (
    <main className="min-h-screen bg-[#FAF7F2] text-[#264653] flex flex-col items-center px-4 py-5 md:py-10">
      <div className="w-full max-w-2xl flex items-center justify-between mb-5">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs md:text-sm font-medium text-slate-600 hover:text-[#DA6868] transition"
        >
          <ArrowLeft className="w-4 h-4" />
          Kembali ke Beranda
        </Link>
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 md:w-11 md:h-11 relative shrink-0 rounded-xl overflow-hidden shadow-xs">
            <Image src="/dekatan2.png" alt="Dekatan" fill className="object-contain" priority />
          </div>
          <span className="text-[11px] md:text-xs font-semibold tracking-wider text-[#DA6868] uppercase bg-rose-50 px-3 py-1 md:py-1.5 rounded-full border border-rose-100">
            Mode Sendiri
          </span>
        </div>
      </div>

      {!finalStripUrl && (
        <div className="w-full max-w-md flex flex-col items-center">
          <div className="relative w-full aspect-[3/4] bg-black rounded-3xl overflow-hidden shadow-xl border-4 border-white">
            {cameraError ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center text-white bg-slate-800">
                <p className="text-sm text-red-300 mb-4">{cameraError}</p>
                <button
                  onClick={startCamera}
                  className="px-4 py-2 bg-[#DA6868] text-white rounded-xl text-sm font-medium hover:bg-[#c95757]"
                >
                  Coba Lagi
                </button>
              </div>
            ) : (
              <>
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover -scale-x-100"
                />

                {showFlash && <div className="absolute inset-0 bg-white animate-fade-out z-20" />}

                {countdown !== null && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/30 backdrop-blur-[2px] z-10">
                    <span className="text-8xl font-black text-white drop-shadow-lg animate-pulse">
                      {countdown}
                    </span>
                  </div>
                )}

                {isCapturing && (
                  <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full text-white text-xs font-medium z-10">
                    Foto ke-{currentShot} dari 4
                  </div>
                )}
              </>
            )}
          </div>

          <div className="flex gap-2 my-4">
            {[0, 1, 2, 3].map((idx) => (
              <div
                key={idx}
                className={`w-3 h-3 rounded-full transition-all ${
                  capturedPhotos[idx]
                    ? 'bg-[#DA6868] scale-110'
                    : isCapturing && currentShot === idx + 1
                    ? 'bg-[#DA6868]/50 animate-pulse'
                    : 'bg-stone-300'
                }`}
              />
            ))}
          </div>

          <div className="w-full mt-1">
            <button
              onClick={startPhotoSession}
              disabled={!cameraReady || isCapturing || isGeneratingStrip}
              className={`w-full py-4 rounded-2xl font-bold text-white shadow-lg flex items-center justify-center gap-3 touch-manipulation transition-all ${
                !cameraReady || isCapturing || isGeneratingStrip
                  ? 'bg-slate-400 cursor-not-allowed opacity-60'
                  : 'bg-[#DA6868] hover:bg-[#c85656] active:scale-[0.98]'
              }`}
            >
              <Camera className="w-5 h-5" />
              {isCapturing
                ? `Mengambil Foto (${currentShot}/4)...`
                : isGeneratingStrip
                ? 'Menyusun Foto...'
                : 'Mulai Foto (4 Jepretan)'}
            </button>
            <p className="text-center text-xs text-slate-500 mt-2.5">
              Kamera menghitung 3 detik otomatis untuk setiap jepretan.
            </p>
          </div>
        </div>
      )}

      {finalStripUrl && (
        <div className="w-full max-w-md flex flex-col items-center animate-fade-in">
          <div className="flex items-center gap-2 text-stone-600 mb-2 text-sm font-semibold">
            <Sparkles className="w-4 h-4 text-[#DA6868]" />
            Hasil Fotomu Sudah Jadi!
          </div>

          {/* PEMILIH TATA LETAK */}
          <div className="flex flex-wrap items-center justify-center gap-1.5 mb-2 bg-white p-1.5 rounded-2xl shadow-xs border border-stone-200">
            <span className="text-[11px] font-semibold text-stone-500 px-1">Layout:</span>
            <button
              onClick={() => handleLayoutChange('strip4')}
              className={`px-2.5 py-1 rounded-xl text-xs font-medium flex items-center gap-1 touch-manipulation transition ${
                selectedLayout === 'strip4'
                  ? 'bg-[#DA6868] text-white shadow-xs'
                  : 'text-stone-600 hover:bg-stone-100'
              }`}
            >
              <Rows className="w-3.5 h-3.5" />
              Strip (1×4)
            </button>
            <button
              onClick={() => handleLayoutChange('strip3')}
              className={`px-2.5 py-1 rounded-xl text-xs font-medium flex items-center gap-1 touch-manipulation transition ${
                selectedLayout === 'strip3'
                  ? 'bg-[#DA6868] text-white shadow-xs'
                  : 'text-stone-600 hover:bg-stone-100'
              }`}
            >
              <Rows className="w-3.5 h-3.5" />
              Strip (1×3)
            </button>
            <button
              onClick={() => handleLayoutChange('grid')}
              className={`px-2.5 py-1 rounded-xl text-xs font-medium flex items-center gap-1 touch-manipulation transition ${
                selectedLayout === 'grid'
                  ? 'bg-[#DA6868] text-white shadow-xs'
                  : 'text-stone-600 hover:bg-stone-100'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              Grid (2×2)
            </button>
          </div>

          {/* TAB: FILTER ATAU STIKER */}
          <div className="w-full bg-stone-200/70 p-1 rounded-2xl flex gap-1 mb-2.5">
            <button
              onClick={() => setActiveTab('filter')}
              className={`flex-1 py-1.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition ${
                activeTab === 'filter'
                  ? 'bg-white text-stone-800 shadow-xs'
                  : 'text-stone-600 hover:text-stone-800'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              Filter & Frame
            </button>
            <button
              onClick={() => setActiveTab('stiker')}
              className={`flex-1 py-1.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition ${
                activeTab === 'stiker'
                  ? 'bg-white text-[#DA6868] shadow-xs'
                  : 'text-stone-600 hover:text-stone-800'
              }`}
            >
              <Smile className="w-3.5 h-3.5" />
              Stiker Digital ({placedStickers.length})
            </button>
          </div>

          {/* KONTEN TAB FILTER */}
          {activeTab === 'filter' && (
            <div className="w-full flex flex-col gap-2 mb-3 animate-fade-in">
              <div className="flex items-center justify-center gap-1.5 bg-white px-3 py-1.5 rounded-2xl shadow-xs border border-stone-200">
                <span className="text-xs font-semibold text-stone-500 mr-1">Filter:</span>
                {(Object.keys(PHOTO_FILTERS) as PhotoFilterKey[]).map((key) => {
                  const item = PHOTO_FILTERS[key];
                  const isSelected = selectedFilter === key;
                  return (
                    <button
                      key={key}
                      onClick={() => handleFilterChange(key)}
                      className={`px-3 py-1 rounded-xl text-xs font-medium touch-manipulation transition-all ${
                        isSelected
                          ? 'bg-[#DA6868] text-white shadow-xs'
                          : 'text-stone-600 hover:bg-stone-100'
                      }`}
                    >
                      {item.name}
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center justify-center gap-3 bg-white px-4 py-2 rounded-2xl shadow-xs border border-stone-200">
                <span className="text-xs font-semibold text-stone-500 mr-1">Warna Frame:</span>
                {(Object.keys(FRAME_THEMES) as FrameThemeKey[]).map((key) => {
                  const theme = FRAME_THEMES[key];
                  const isSelected = selectedTheme === key;
                  return (
                    <button
                      key={key}
                      onClick={() => handleThemeChange(key)}
                      className={`w-7 h-7 rounded-full transition-all border-2 touch-manipulation flex items-center justify-center ${
                        isSelected
                          ? 'scale-110 ring-2 ring-[#DA6868] ring-offset-2'
                          : 'hover:scale-105 opacity-85'
                      }`}
                      style={{ backgroundColor: theme.bg, borderColor: theme.swatchBorder }}
                      title={theme.name}
                    />
                  );
                })}
              </div>
            </div>
          )}

          {/* KONTEN TAB STIKER */}
          {activeTab === 'stiker' && (
            <div className="w-full bg-white p-3 rounded-2xl shadow-xs border border-stone-200 mb-3 animate-fade-in">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-semibold text-stone-600">
                  Ketuk emoji untuk menempel ke foto:
                </span>
                {placedStickers.length > 0 && (
                  <button
                    onClick={() => {
                      setPlacedStickers([]);
                      setSelectedStickerId(null);
                    }}
                    className="text-[10px] text-red-500 font-medium hover:underline"
                  >
                    Hapus Semua
                  </button>
                )}
              </div>

              <div className="grid grid-cols-6 gap-2 mb-3">
                {AVAILABLE_STICKERS.map((emoji, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleAddSticker(emoji)}
                    className="h-10 text-xl bg-stone-50 hover:bg-rose-50 rounded-xl border border-stone-100 active:scale-95 touch-manipulation flex items-center justify-center transition"
                  >
                    {emoji}
                  </button>
                ))}
              </div>

              {/* PANEL KONTROL UKURAN STIKER AKTIF */}
              {currentSelectedSticker && (
                <div className="bg-rose-50/70 p-2.5 rounded-xl border border-rose-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{currentSelectedSticker.emoji}</span>
                    <span className="text-xs font-semibold text-stone-700">
                      Ukuran: {Math.round(currentSelectedSticker.scale * 100)}%
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => adjustStickerScale(currentSelectedSticker.id, -0.2)}
                      className="p-1.5 bg-white text-stone-700 rounded-lg border border-stone-200 hover:bg-stone-50 active:scale-95 transition"
                      title="Perkecil"
                    >
                      <ZoomOut className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => adjustStickerScale(currentSelectedSticker.id, 0.2)}
                      className="p-1.5 bg-white text-stone-700 rounded-lg border border-stone-200 hover:bg-stone-50 active:scale-95 transition"
                      title="Perbesar"
                    >
                      <ZoomIn className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* INPUT PESAN PRIBADI */}
          <div className="w-full bg-white p-3 rounded-2xl shadow-xs border border-stone-200 mb-3">
            <label className="block text-xs font-semibold text-stone-600 mb-1.5">
              Pesan Pribadi / Catatan Singkat:
            </label>
            <input
              type="text"
              maxLength={40}
              placeholder="Contoh: Me Time, Liburan Sendiri..."
              value={customNote}
              onChange={(e) => handleNoteChange(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-stone-200 focus:outline-none focus:border-[#DA6868] text-stone-700 placeholder:text-stone-400"
            />
          </div>

          {/* PRATINJAU KERTAS STRIP + LAPISAN STIKER (BISA DISCROLL + BISA DIUBAH UKURAN) */}
          <div
            ref={previewContainerRef}
            onClick={() => setSelectedStickerId(null)}
            className={`relative select-none p-3 bg-white rounded-2xl shadow-2xl border border-stone-200 touch-pan-y ${
              selectedLayout === 'grid'
                ? 'max-w-[320px]'
                : selectedLayout === 'strip3'
                ? 'max-w-[250px]'
                : 'max-w-[270px]'
            }`}
          >
            {/* eslint-disable-next-html-element/no-img-element */}
            <img
              src={finalStripUrl}
              alt="Hasil Photobooth"
              className="w-full h-auto rounded-lg shadow-inner pointer-events-none select-none touch-pan-y"
            />

            {/* Lapisan Stiker yang Bisa Digeser dan Diubah Ukurannya */}
            {placedStickers.map((stk) => {
              const isSelected = selectedStickerId === stk.id;
              const scale = stk.scale || 1.0;

              return (
                <div
                  key={stk.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedStickerId(stk.id);
                  }}
                  onPointerDown={(e) => handleStickerPointerDown(e, stk.id)}
                  onPointerMove={(e) => handleStickerPointerMove(e, stk.id)}
                  onPointerUp={handleStickerPointerUp}
                  onPointerCancel={handleStickerPointerUp}
                  style={{
                    left: `${stk.x}%`,
                    top: `${stk.y}%`,
                    transform: `translate(-50%, -50%) scale(${scale})`,
                  }}
                  className={`absolute text-3xl touch-none select-none cursor-grab active:cursor-grabbing ${
                    activeDraggingId === stk.id ? 'z-30 drop-shadow-xl' : isSelected ? 'z-25' : 'z-20'
                  }`}
                >
                  <div
                    className={`relative p-1.5 transition-all ${
                      isSelected || activeDraggingId === stk.id
                        ? 'ring-2 ring-dashed ring-[#DA6868] rounded-xl bg-white/40 backdrop-blur-[1px]'
                        : ''
                    }`}
                  >
                    <span>{stk.emoji}</span>

                    {/* Tombol Hapus Kecil */}
                    <button
                      type="button"
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={(e) => handleRemoveSticker(stk.id, e)}
                      className="absolute -top-2 -right-2 bg-stone-900/80 text-white rounded-full p-0.5 hover:bg-red-500 transition shadow-sm"
                      title="Hapus"
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>

                    {/* Gagang Sudut Ubah Ukuran (Corner Resize Handle) */}
                    <div
                      onPointerDown={(e) => handleResizeHandleDown(e, stk.id, scale)}
                      onPointerMove={handleResizeHandleMove}
                      onPointerUp={handleResizeHandleUp}
                      onPointerCancel={handleResizeHandleUp}
                      className="absolute -bottom-2 -right-2 w-5 h-5 bg-[#DA6868] text-white rounded-full flex items-center justify-center cursor-se-resize shadow-md active:scale-125 touch-none"
                      title="Tarik sudut untuk membesarkan/mengecilkan"
                    >
                      <Maximize2 className="w-2.5 h-2.5" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {placedStickers.length > 0 && (
            <p className="text-[11px] text-stone-500 mt-2 text-center">
              💡 Seret stiker untuk pindah posisi, atau tarik titik merah di sudutnya untuk mengatur ukuran.
            </p>
          )}

          <div className="w-full flex flex-col gap-3 mt-5">
            <button
              onClick={handleDownload}
              className="w-full py-3.5 bg-[#DA6868] text-white font-bold rounded-xl shadow-md hover:bg-[#c85656] active:scale-95 touch-manipulation flex items-center justify-center gap-2 transition"
            >
              <Download className="w-5 h-5" />
              Simpan / Bagikan Foto Strip
            </button>

            <button
              onClick={handleRetake}
              className="w-full py-3.5 bg-white text-slate-700 font-semibold rounded-xl border border-stone-300 hover:bg-stone-50 active:scale-95 touch-manipulation flex items-center justify-center gap-2 transition"
            >
              <RefreshCw className="w-4 h-4" />
              Foto Ulang
            </button>
          </div>
        </div>
      )}
    </main>
  );
}