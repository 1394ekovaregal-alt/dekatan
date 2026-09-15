'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Camera, RefreshCw, Download, ArrowLeft, Sparkles } from 'lucide-react';

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

export default function SoloPhotobooth() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

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
  const [customNote, setCustomNote] = useState<string>('');

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
          video: { facingMode: 'user' },
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
      note: string = customNote
    ) => {
      setIsGeneratingStrip(true);

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const theme = FRAME_THEMES[themeKey];

      const stripWidth = 560;
      const padding = 32;
      const spacing = 20;
      const photoWidth = stripWidth - padding * 2;
      const photoHeight = Math.round(photoWidth * (4 / 3));
      const footerHeight = note.trim() ? 245 : 210;

      const totalHeight = padding * 2 + photoHeight * 4 + spacing * 3 + footerHeight;

      canvas.width = stripWidth;
      canvas.height = totalHeight;

      ctx.fillStyle = theme.bg;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      for (let i = 0; i < photos.length; i++) {
        const img = new (window as any).Image();
        img.src = photos[i];
        await new Promise((resolve) => {
          img.onload = resolve;
        });

        const yPos = padding + i * (photoHeight + spacing);
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
        ctx.drawImage(img, sx, sy, sWidth, sHeight, padding, yPos, photoWidth, photoHeight);
        ctx.restore();

        ctx.strokeStyle = theme.border;
        ctx.lineWidth = 2;
        ctx.strokeRect(padding, yPos, photoWidth, photoHeight);
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
      ctx.fillText('Solo Photobooth • Edisi Mandiri', stripWidth / 2, currentTextY + 20);

      const dataUrl = canvas.toDataURL('image/png');
      setFinalStripUrl(dataUrl);
      setIsGeneratingStrip(false);
      stopCamera();
    },
    [selectedTheme, selectedFilter, customNote, stopCamera]
  );

  const startPhotoSession = async () => {
    initAudio();
    setIsCapturing(true);
    setCapturedPhotos([]);
    setFinalStripUrl(null);

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
    generatePhotoStrip(tempPhotos, selectedTheme, selectedFilter, customNote);
  };

  const handleThemeChange = (newTheme: FrameThemeKey) => {
    setSelectedTheme(newTheme);
    if (capturedPhotos.length > 0) {
      generatePhotoStrip(capturedPhotos, newTheme, selectedFilter, customNote);
    }
  };

  const handleFilterChange = (newFilter: PhotoFilterKey) => {
    setSelectedFilter(newFilter);
    if (capturedPhotos.length > 0) {
      generatePhotoStrip(capturedPhotos, selectedTheme, newFilter, customNote);
    }
  };

  const handleNoteChange = (text: string) => {
    setCustomNote(text);
    if (capturedPhotos.length > 0) {
      generatePhotoStrip(capturedPhotos, selectedTheme, selectedFilter, text);
    }
  };

  const handleDownload = () => {
    if (!finalStripUrl) return;
    const link = document.createElement('a');
    link.download = `dekatan-solo-${selectedTheme}-${selectedFilter}-${Date.now()}.png`;
    link.href = finalStripUrl;
    link.click();
  };

  const handleRetake = () => {
    setFinalStripUrl(null);
    setCapturedPhotos([]);
    setCurrentShot(0);
    startCamera();
  };

  return (
    <main className="min-h-screen bg-[#FAF7F2] text-[#264653] flex flex-col items-center px-4 py-6 md:py-10">
      <div className="w-full max-w-2xl flex items-center justify-between mb-6">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-[#DA6868] transition"
        >
          <ArrowLeft className="w-4 h-4" />
          Kembali ke Beranda
        </Link>
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 relative shrink-0 rounded-xl overflow-hidden shadow-xs">
            <Image
              src="/dekatan2.png"
              alt="Dekatan"
              fill
              className="object-contain"
              priority
            />
          </div>
          <span className="text-xs font-semibold tracking-wider text-[#DA6868] uppercase bg-rose-50 px-3.5 py-1.5 rounded-full border border-rose-100">
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

          <div className="w-full mt-2">
            <button
              onClick={startPhotoSession}
              disabled={!cameraReady || isCapturing || isGeneratingStrip}
              className={`w-full py-4 rounded-2xl font-bold text-white shadow-lg flex items-center justify-center gap-3 transition-all ${
                !cameraReady || isCapturing || isGeneratingStrip
                  ? 'bg-slate-400 cursor-not-allowed opacity-60'
                  : 'bg-[#DA6868] hover:bg-[#c85656] hover:shadow-xl active:scale-[0.98]'
              }`}
            >
              <Camera className="w-5 h-5" />
              {isCapturing
                ? `Sedang Mengambil Foto (${currentShot}/4)...`
                : isGeneratingStrip
                ? 'Menyusun Strip Foto...'
                : 'Mulai Foto (4 Jepretan)'}
            </button>
            <p className="text-center text-xs text-slate-500 mt-3">
              Kamera akan menghitung 3 detik secara otomatis untuk setiap foto.
            </p>
          </div>
        </div>
      )}

      {finalStripUrl && (
        <div className="w-full max-w-md flex flex-col items-center animate-fade-in">
          <div className="flex items-center gap-2 text-stone-600 mb-2 text-sm font-semibold">
            <Sparkles className="w-4 h-4 text-[#DA6868]" />
            Strip Fotomu Sudah Jadi!
          </div>

          {/* PEMILIH FILTER ESTETIK */}
          <div className="flex items-center gap-1.5 mb-2.5 bg-white px-3 py-1.5 rounded-2xl shadow-xs border border-stone-200">
            <span className="text-xs font-semibold text-stone-500 mr-1.5">Filter:</span>
            {(Object.keys(PHOTO_FILTERS) as PhotoFilterKey[]).map((key) => {
              const item = PHOTO_FILTERS[key];
              const isSelected = selectedFilter === key;
              return (
                <button
                  key={key}
                  onClick={() => handleFilterChange(key)}
                  className={`px-3 py-1 rounded-xl text-xs font-medium transition-all ${
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

          {/* PEMILIH WARNA BINGKAI */}
          <div className="flex items-center gap-3 mb-3 bg-white px-4 py-2.5 rounded-2xl shadow-xs border border-stone-200">
            <span className="text-xs font-semibold text-stone-500 mr-1">Warna:</span>
            {(Object.keys(FRAME_THEMES) as FrameThemeKey[]).map((key) => {
              const theme = FRAME_THEMES[key];
              const isSelected = selectedTheme === key;
              return (
                <button
                  key={key}
                  onClick={() => handleThemeChange(key)}
                  className={`w-7 h-7 rounded-full transition-all border-2 flex items-center justify-center ${
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

          {/* INPUT PESAN PRIBADI */}
          <div className="w-full bg-white p-3 rounded-2xl shadow-xs border border-stone-200 mb-4">
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
            <div className="flex justify-between items-center mt-1">
              <span className="text-[10px] text-stone-400">Tercetak langsung di bawah logo strip foto</span>
              <span className="text-[10px] text-stone-400">{customNote.length}/40</span>
            </div>
          </div>

          {/* PRATINJAU KERTAS STRIP FOTO */}
          <div className="p-3 bg-white rounded-2xl shadow-2xl border border-stone-200 max-w-[280px]">
            {/* eslint-disable-next-html-element/no-img-element */}
            <img
              src={finalStripUrl}
              alt="Hasil Photobooth"
              className="w-full h-auto rounded-lg shadow-inner"
            />
          </div>

          <div className="w-full flex flex-col gap-3 mt-6">
            <button
              onClick={handleDownload}
              className="w-full py-3.5 bg-[#DA6868] text-white font-bold rounded-xl shadow-md hover:bg-[#c85656] flex items-center justify-center gap-2 transition"
            >
              <Download className="w-5 h-5" />
              Unduh Foto Strip ({FRAME_THEMES[selectedTheme].name})
            </button>

            <button
              onClick={handleRetake}
              className="w-full py-3.5 bg-white text-slate-700 font-semibold rounded-xl border border-stone-300 hover:bg-stone-50 flex items-center justify-center gap-2 transition"
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