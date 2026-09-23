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
  Smile,
  SlidersHorizontal,
  X,
  Maximize2,
  ZoomIn,
  ZoomOut,
  Palette,
  AlignLeft,
  AlignCenter,
  AlignRight,
} from 'lucide-react';
import TemplateSelectorModal, {
  FrameTemplate,
  FRAME_TEMPLATES,
  LayoutMode,
} from '@/components/TemplateSelectorModal';

const PHOTO_FILTERS = {
  normal: { name: 'Asli', filter: 'none' },
  bw: { name: 'Monochrome', filter: 'grayscale(100%) contrast(115%)' },
  vintage: { name: 'Retro Film', filter: 'sepia(35%) contrast(105%) brightness(95%) saturate(85%)' },
  warm: { name: 'Warm Soft', filter: 'sepia(15%) saturate(125%) brightness(105%) contrast(95%)' },
} as const;

type PhotoFilterKey = keyof typeof PHOTO_FILTERS;
type TextAlign = 'left' | 'center' | 'right';

const AVAILABLE_STICKERS = [
  '❤️', '💖', '✨', '🎀', '🧸', '🌸',
  '👑', '⭐', '💌', '🐱', '🍒', '🍓',
  '☁️', '🔥', '😎', '🍀', '🌼', '🎂',
];

const NOTE_FONTS = [
  { id: 'sans', name: 'Modern', family: 'sans-serif' },
  { id: 'serif', name: 'Elegan', family: 'Georgia, serif' },
  { id: 'hand', name: 'Aesthetic', family: 'cursive' },
  { id: 'mono', name: 'Retro Tik', family: 'Courier New, monospace' },
] as const;

const NOTE_COLORS = [
  { id: 'coral', name: 'Coral', value: '#DA6868' },
  { id: 'dark', name: 'Hitam', value: '#1E293B' },
  { id: 'white', name: 'Putih', value: '#FFFFFF' },
  { id: 'brown', name: 'Earthy', value: '#8B5E3C' },
  { id: 'lavender', name: 'Lilac', value: '#8B5CF6' },
] as const;

interface PlacedSticker {
  id: string;
  emoji: string;
  x: number;
  y: number;
  scale: number;
}

// Fungsi Bantu: Memindai Lubang Transparan Otomatis dari Gambar Frame PNG
const detectPhotoSlots = (
  img: HTMLImageElement,
  targetW: number,
  targetH: number
): { x: number; y: number; width: number; height: number }[] => {
  try {
    const scanCanvas = document.createElement('canvas');
    scanCanvas.width = targetW;
    scanCanvas.height = targetH;
    const scanCtx = scanCanvas.getContext('2d', { willReadFrequently: true });
    if (!scanCtx) return [];

    scanCtx.drawImage(img, 0, 0, targetW, targetH);
    const imgData = scanCtx.getImageData(0, 0, targetW, targetH).data;

    const getAlpha = (x: number, y: number) => {
      if (x < 0 || x >= targetW || y < 0 || y >= targetH) return 255;
      return imgData[(y * targetW + x) * 4 + 3];
    };

    const centerX = Math.round(targetW / 2);
    const verticalSegments: { startY: number; endY: number }[] = [];
    let inSlot = false;
    let startY = 0;

    for (let y = 10; y < targetH - 10; y++) {
      const a = getAlpha(centerX, y);
      const isTransparent = a < 90;

      if (isTransparent && !inSlot) {
        inSlot = true;
        startY = y;
      } else if (!isTransparent && inSlot) {
        inSlot = false;
        if (y - startY > 60) {
          verticalSegments.push({ startY, endY: y });
        }
      }
    }
    if (inSlot && targetH - startY > 60) {
      verticalSegments.push({ startY, endY: targetH - 10 });
    }

    if (verticalSegments.length < 3) return [];

    const bleed = 8;
    return verticalSegments.map((seg) => {
      const midY = Math.round((seg.startY + seg.endY) / 2);
      let leftX = centerX;
      while (leftX > 10 && getAlpha(leftX, midY) < 100) {
        leftX--;
      }
      let rightX = centerX;
      while (rightX < targetW - 10 && getAlpha(rightX, midY) < 100) {
        rightX++;
      }
      const w = rightX - leftX;
      const h = seg.endY - seg.startY;
      return {
        x: Math.max(0, leftX - bleed),
        y: Math.max(0, seg.startY - bleed),
        width: w + bleed * 2,
        height: h + bleed * 2,
      };
    });
  } catch (_) {
    return [];
  }
};

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

  // Template & Tata Letak
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<FrameTemplate>(FRAME_TEMPLATES[0]);
  const [selectedLayout, setSelectedLayout] = useState<LayoutMode>('strip4');
  const [selectedFilter, setSelectedFilter] = useState<PhotoFilterKey>('normal');

  // Catatan, Font, Warna, Susunan, & Posisi Jari
  const [customNote, setCustomNote] = useState<string>('');
  const [noteFont, setNoteFont] = useState<string>('sans-serif');
  const [noteColor, setNoteColor] = useState<string>('#DA6868');
  const [noteAlign, setNoteAlign] = useState<TextAlign>('center');
  const [notePos, setNotePos] = useState<{ x: number; y: number; scale: number }>({
    x: 50,
    y: 86,
    scale: 1.0,
  });
  const [isDraggingNote, setIsDraggingNote] = useState(false);
  const [noteResizeState, setNoteResizeState] = useState<{
    startX: number;
    startY: number;
    initialScale: number;
  } | null>(null);

  // Stiker
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
    } catch (_) {}
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
    } catch (_) {}
  }, [initAudio]);

  const startCamera = useCallback(async () => {
    try {
      setCameraError(null);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
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
          videoRef.current?.play().catch(() => {});
        };
      }
      setCameraReady(true);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setCameraError(`${err.name}: ${err.message}`);
      } else {
        setCameraError('Kamera tidak dapat diakses.');
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
      template: FrameTemplate = selectedTemplate,
      filterKey: PhotoFilterKey = selectedFilter,
      note: string = customNote,
      layout: LayoutMode = selectedLayout,
      stickersToDraw: PlacedSticker[] = placedStickers,
      currentFont: string = noteFont,
      currentColor: string = noteColor,
      currentAlign: TextAlign = noteAlign,
      currentNotePos: { x: number; y: number; scale: number } = notePos
    ) => {
      setIsGeneratingStrip(true);
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const hasCustomOverlay = Boolean((template as any)?.overlayUrl);
      let overlayImg: HTMLImageElement | null = null;

      if (hasCustomOverlay) {
        const img = document.createElement('img');
        img.crossOrigin = 'anonymous';
        img.src = (template as any).overlayUrl;
        await new Promise((resolve) => {
          img.onload = resolve;
          img.onerror = resolve;
        });
        overlayImg = img;
      }

      const drawCoverImage = (
        img: HTMLImageElement,
        x: number,
        y: number,
        w: number,
        h: number,
        radius: number = 0
      ) => {
        const imgRatio = img.width / img.height;
        const targetRatio = w / h;
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
        if (radius > 0) {
          ctx.beginPath();
          ctx.roundRect(x, y, w, h, radius);
          ctx.clip();
        }
        ctx.filter = PHOTO_FILTERS[filterKey].filter;
        ctx.drawImage(img, sx, sy, sWidth, sHeight, x, y, w, h);
        ctx.restore();
      };

      // ================= 1. JIKA MENGGUNAKAN TEMPLATE OVERLAY ADMIN =================
      if (hasCustomOverlay && overlayImg && overlayImg.naturalWidth > 0) {
        const overlayRatio = overlayImg.naturalWidth / overlayImg.naturalHeight;
        const isStory916 = overlayRatio > 0.45;

        let W = 600;
        let H = Math.round(W / overlayRatio);

        if (isStory916) {
          W = 1080;
          H = 1920;
        }

        canvas.width = W;
        canvas.height = H;

        ctx.fillStyle = template.bg || '#FAF7F2';
        ctx.fillRect(0, 0, W, H);

        const renderPhotos = photos.slice(0, 4);
        const autoSlots = detectPhotoSlots(overlayImg, W, H);

        if (autoSlots.length >= renderPhotos.length) {
          for (let i = 0; i < renderPhotos.length; i++) {
            const img = document.createElement('img');
            img.src = renderPhotos[i];
            await new Promise((resolve) => {
              img.onload = resolve;
            });

            const slot = autoSlots[i];
            drawCoverImage(img, slot.x, slot.y, slot.width, slot.height, 4);
          }
        } else {
          const photoW = isStory916 ? 530 : 520;
          const photoH = isStory916 ? 375 : 374;
          const posX = (W - photoW) / 2;
          const startY = isStory916 ? 180 : 55;
          const gap = isStory916 ? 28 : 30;

          for (let i = 0; i < renderPhotos.length; i++) {
            const img = document.createElement('img');
            img.src = renderPhotos[i];
            await new Promise((resolve) => {
              img.onload = resolve;
            });

            const y = startY + i * (photoH + gap);
            drawCoverImage(img, posX, y, photoW, photoH, 6);
          }
        }

        // Tempelkan Overlay Bingkai PNG di atas foto
        ctx.drawImage(overlayImg, 0, 0, W, H);

        // Watermark Resmi Dekatan (Logo & Tanggal)
        const darkColors = ['#18181B', '#232931', '#450A0A', '#0F172A', '#DA6868'];
        const isDarkTheme = (template as any)?.isDark || darkColors.includes(template.bg);

        const logoImg = document.createElement('img');
        logoImg.src = isDarkTheme ? '/dekatan-white.png' : '/dekatan1.png';
        await new Promise((resolve) => {
          logoImg.onload = resolve;
          logoImg.onerror = resolve;
        });

        const logoW = isStory916 ? 160 : 120;
        const logoH = logoImg.naturalHeight
          ? (logoImg.naturalHeight / logoImg.naturalWidth) * logoW
          : 36;
        const logoX = (W - logoW) / 2;
        const logoY = H - logoH - (isStory916 ? 60 : 42);

        if (logoImg.complete && logoImg.naturalWidth !== 0) {
          ctx.drawImage(logoImg, logoX, logoY, logoW, logoH);
        }

        const now = new Date();
        const formattedDate = now.toLocaleDateString('id-ID', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        });
        const formattedTime = now
          .toLocaleTimeString('id-ID', {
            hour: '2-digit',
            minute: '2-digit',
          })
          .replace(':', '.');

        const dateTextY = logoY + logoH + (isStory916 ? 24 : 16);
        ctx.font = isStory916 ? '500 18px sans-serif' : '500 12px sans-serif';
        ctx.fillStyle = isDarkTheme ? 'rgba(255, 255, 255, 0.85)' : '#64748B';
        ctx.textAlign = 'center';
        ctx.fillText(`${formattedDate} • ${formattedTime} WITA`, W / 2, dateTextY);

        // Catatan Kustom Bebas Geser & Susunan Teks
        if (note.trim()) {
          const pixelX = (currentNotePos.x / 100) * W;
          const pixelY = (currentNotePos.y / 100) * H;
          const baseSize = isStory916 ? 24 : 16;
          const dynamicSize = Math.round(baseSize * currentNotePos.scale);

          ctx.font = `600 ${dynamicSize}px ${currentFont}`;
          ctx.fillStyle = currentColor;
          ctx.textAlign = currentAlign;
          ctx.textBaseline = 'middle';
          ctx.fillText(`“${note.trim()}”`, pixelX, pixelY);
        }

        // Stiker Digital
        if (stickersToDraw && stickersToDraw.length > 0) {
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          for (const stk of stickersToDraw) {
            const pixelX = (stk.x / 100) * W;
            const pixelY = (stk.y / 100) * H;
            const dynamicFontSize = Math.round((isStory916 ? 56 : 38) * (stk.scale || 1));
            ctx.font = `${dynamicFontSize}px sans-serif`;
            ctx.fillText(stk.emoji, pixelX, pixelY);
          }
        }
      } else {
        // ================= 2. TEMPLATE STANDAR FREMIO (BAWAAN) =================
        const isGrid = layout === 'grid';
        const isStrip3 = layout === 'strip3';
        const padding = 32;
        const spacing = 18;
        const footerHeight = 195;

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

        ctx.fillStyle = template.bg;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        if (template.pattern === 'film') {
          ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
          const holeH = 14;
          const holeW = 8;
          for (let y = 15; y < totalHeight - 20; y += 26) {
            ctx.fillRect(6, y, holeW, holeH);
            ctx.fillRect(stripWidth - 14, y, holeW, holeH);
          }
        }

        for (let i = 0; i < renderPhotos.length; i++) {
          const img = document.createElement('img');
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
          ctx.beginPath();
          if (template.slotShape === 'arch') {
            ctx.roundRect(xPos, yPos, photoWidth, photoHeight, [photoWidth / 2, photoWidth / 2, 8, 8]);
          } else if (template.slotShape === 'rounded') {
            ctx.roundRect(xPos, yPos, photoWidth, photoHeight, 16);
          } else if (template.slotShape === 'heart') {
            const topCurveHeight = photoHeight * 0.3;
            ctx.moveTo(xPos + photoWidth / 2, yPos + photoHeight);
            ctx.bezierCurveTo(
              xPos,
              yPos + photoHeight * 0.7,
              xPos,
              yPos + topCurveHeight,
              xPos + photoWidth / 4,
              yPos
            );
            ctx.bezierCurveTo(
              xPos + photoWidth / 2,
              yPos,
              xPos + photoWidth / 2,
              yPos + topCurveHeight,
              xPos + photoWidth / 2,
              yPos + topCurveHeight
            );
            ctx.bezierCurveTo(
              xPos + photoWidth / 2,
              yPos + topCurveHeight,
              xPos + photoWidth / 2,
              yPos,
              xPos + (photoWidth * 3) / 4,
              yPos
            );
            ctx.bezierCurveTo(
              xPos + photoWidth,
              yPos + topCurveHeight,
              xPos + photoWidth,
              yPos + photoHeight * 0.7,
              xPos + photoWidth / 2,
              yPos + photoHeight
            );
          } else {
            ctx.rect(xPos, yPos, photoWidth, photoHeight);
          }
          ctx.clip();

          ctx.filter = PHOTO_FILTERS[filterKey].filter;
          ctx.drawImage(img, sx, sy, sWidth, sHeight, xPos, yPos, photoWidth, photoHeight);
          ctx.restore();

          ctx.strokeStyle = template.slotBorder;
          ctx.lineWidth = 2.5;
          ctx.stroke();
        }

        const footerStartY = totalHeight - footerHeight;
        ctx.strokeStyle = template.border;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(padding + 20, footerStartY + 10);
        ctx.lineTo(stripWidth - padding - 20, footerStartY + 10);
        ctx.stroke();

        const darkColors = ['#18181B', '#232931', '#450A0A', '#0F172A', '#DA6868'];
        const isDarkTheme = (template as any)?.isDark || darkColors.includes(template.bg);

        const logoImg = document.createElement('img');
        logoImg.src = isDarkTheme ? '/dekatan-white.png' : '/dekatan1.png';
        await new Promise((resolve) => {
          logoImg.onload = resolve;
          logoImg.onerror = resolve;
        });

        const logoWidth = 180;
        const logoHeight = logoImg.naturalHeight
          ? (logoImg.naturalHeight / logoImg.naturalWidth) * logoWidth
          : 50;
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
        const formattedTime = now
          .toLocaleTimeString('id-ID', {
            hour: '2-digit',
            minute: '2-digit',
          })
          .replace(':', '.');

        const currentTextY = logoY + logoHeight + 24;
        ctx.font = '500 13px sans-serif';
        ctx.fillStyle = template.subTextColor;
        ctx.textAlign = 'center';
        ctx.fillText(`${formattedDate} • ${formattedTime} WITA`, stripWidth / 2, currentTextY);

        ctx.font = '700 12px sans-serif';
        ctx.fillStyle = template.textColor;
        ctx.fillText(template.labelFooter || 'DEKATAN PHOTOBOOTH', stripWidth / 2, currentTextY + 20);

        if (note.trim()) {
          const pixelX = (currentNotePos.x / 100) * stripWidth;
          const pixelY = (currentNotePos.y / 100) * totalHeight;
          const dynamicSize = Math.round(16 * currentNotePos.scale);

          ctx.font = `600 ${dynamicSize}px ${currentFont}`;
          ctx.fillStyle = currentColor;
          ctx.textAlign = currentAlign;
          ctx.textBaseline = 'middle';
          ctx.fillText(`“${note.trim()}”`, pixelX, pixelY);
        }

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
      }

      const dataUrl = canvas.toDataURL('image/png');
      setFinalStripUrl(dataUrl);
      setIsGeneratingStrip(false);
      stopCamera();
    },
    [
      selectedTemplate,
      selectedFilter,
      customNote,
      selectedLayout,
      placedStickers,
      noteFont,
      noteColor,
      noteAlign,
      notePos,
      stopCamera,
    ]
  );

  const startPhotoSession = async () => {
    initAudio();
    setIsCapturing(true);
    setCapturedPhotos([]);
    setFinalStripUrl(null);
    setPlacedStickers([]);
    setSelectedStickerId(null);

    const totalShots = selectedLayout === 'strip3' ? 3 : 4;
    const tempPhotos: string[] = [];

    for (let shot = 1; shot <= totalShots; shot++) {
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

      if (shot < totalShots) {
        await new Promise((resolve) => setTimeout(resolve, 1200));
      }
    }

    setIsCapturing(false);
    generatePhotoStrip(
      tempPhotos,
      selectedTemplate,
      selectedFilter,
      customNote,
      selectedLayout,
      [],
      noteFont,
      noteColor,
      noteAlign,
      notePos
    );
  };

  const handleFilterChange = (newFilter: PhotoFilterKey) => {
    setSelectedFilter(newFilter);
    if (capturedPhotos.length > 0) {
      generatePhotoStrip(
        capturedPhotos,
        selectedTemplate,
        newFilter,
        customNote,
        selectedLayout,
        placedStickers,
        noteFont,
        noteColor,
        noteAlign,
        notePos
      );
    }
  };

  const handleNoteChange = (text: string) => {
    setCustomNote(text);
    if (capturedPhotos.length > 0) {
      generatePhotoStrip(
        capturedPhotos,
        selectedTemplate,
        selectedFilter,
        text,
        selectedLayout,
        placedStickers,
        noteFont,
        noteColor,
        noteAlign,
        notePos
      );
    }
  };

  const handleFontChange = (fontFamily: string) => {
    setNoteFont(fontFamily);
    if (capturedPhotos.length > 0) {
      generatePhotoStrip(
        capturedPhotos,
        selectedTemplate,
        selectedFilter,
        customNote,
        selectedLayout,
        placedStickers,
        fontFamily,
        noteColor,
        noteAlign,
        notePos
      );
    }
  };

  const handleColorChange = (colorValue: string) => {
    setNoteColor(colorValue);
    if (capturedPhotos.length > 0) {
      generatePhotoStrip(
        capturedPhotos,
        selectedTemplate,
        selectedFilter,
        customNote,
        selectedLayout,
        placedStickers,
        noteFont,
        colorValue,
        noteAlign,
        notePos
      );
    }
  };

  const handleAlignChange = (align: TextAlign) => {
    setNoteAlign(align);
    if (capturedPhotos.length > 0) {
      generatePhotoStrip(
        capturedPhotos,
        selectedTemplate,
        selectedFilter,
        customNote,
        selectedLayout,
        placedStickers,
        noteFont,
        noteColor,
        align,
        notePos
      );
    }
  };

  // Kontrol Sentuhan Jari untuk Catatan
  const handleNotePointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setIsDraggingNote(true);
    setSelectedStickerId(null);
  };

  const handleNotePointerMove = (e: React.PointerEvent) => {
    if (!isDraggingNote || !previewContainerRef.current) return;
    e.stopPropagation();
    const rect = previewContainerRef.current.getBoundingClientRect();
    const touchX = e.clientX - rect.left;
    const touchY = e.clientY - rect.top;
    const pctX = Math.max(5, Math.min(95, (touchX / rect.width) * 100));
    const pctY = Math.max(5, Math.min(95, (touchY / rect.height) * 100));
    setNotePos((prev) => ({ ...prev, x: pctX, y: pctY }));
  };

  const handleNotePointerUp = (e: React.PointerEvent) => {
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch (_) {}
    setIsDraggingNote(false);
  };

  const handleNoteResizeDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setNoteResizeState({
      startX: e.clientX,
      startY: e.clientY,
      initialScale: notePos.scale,
    });
  };

  const handleNoteResizeMove = (e: React.PointerEvent) => {
    if (!noteResizeState) return;
    e.stopPropagation();
    const delta = e.clientX - noteResizeState.startX + (e.clientY - noteResizeState.startY);
    const newScale = Math.max(
      0.6,
      Math.min(2.5, Number((noteResizeState.initialScale + delta * 0.012).toFixed(2)))
    );
    setNotePos((prev) => ({ ...prev, scale: newScale }));
  };

  const handleNoteResizeUp = (e: React.PointerEvent) => {
    if (!noteResizeState) return;
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch (_) {}
    setNoteResizeState(null);
  };

  const adjustNoteScale = (step: number) => {
    setNotePos((prev) => ({
      ...prev,
      scale: Math.max(0.6, Math.min(2.5, Number((prev.scale + step).toFixed(2)))),
    }));
  };

  // Kontrol Stiker
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
    const delta = e.clientX - resizeState.startX + (e.clientY - resizeState.startY);
    const newScale = Math.max(
      0.5,
      Math.min(2.5, Number((resizeState.initialScale + delta * 0.012).toFixed(2)))
    );
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

  const adjustStickerScale = (id: string, step: number) => {
    setPlacedStickers((prev) =>
      prev.map((s) =>
        s.id === id
          ? {
              ...s,
              scale: Math.max(0.5, Math.min(2.5, Number(((s.scale || 1.0) + step).toFixed(2)))),
            }
          : s
      )
    );
  };

  const handleDownload = async () => {
    if (capturedPhotos.length === 0) return;
    await generatePhotoStrip(
      capturedPhotos,
      selectedTemplate,
      selectedFilter,
      customNote,
      selectedLayout,
      placedStickers,
      noteFont,
      noteColor,
      noteAlign,
      notePos
    );

    const fileName = `dekatan-solo-${selectedTemplate.id}-${Date.now()}.png`;

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
    } catch (_) {}

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
  const totalShotsRequired = selectedLayout === 'strip3' ? 3 : 4;

  return (
    <main className="min-h-screen bg-[#FAF7F2] text-[#264653] flex flex-col items-center px-4 py-5 md:py-8">
      {/* Header */}
      <div className="w-full max-w-2xl flex items-center justify-between mb-4">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs md:text-sm font-medium text-slate-600 hover:text-[#DA6868] transition"
        >
          <ArrowLeft className="w-4 h-4" />
          Beranda
        </Link>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 relative shrink-0 rounded-xl overflow-hidden shadow-xs">
            <Image src="/dekatan2.png" alt="Dekatan" fill className="object-contain" priority />
          </div>
          <span className="text-[11px] font-semibold tracking-wider text-[#DA6868] uppercase bg-rose-50 px-2.5 py-1 rounded-full border border-rose-100">
            Mode Sendiri
          </span>
        </div>
      </div>

      {/* Sesi Kamera */}
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
                    Foto ke-{currentShot} dari {totalShotsRequired}
                  </div>
                )}
              </>
            )}
          </div>

          <button
            onClick={() => setIsTemplateModalOpen(true)}
            disabled={isCapturing}
            className="w-full mt-3.5 py-2.5 px-4 bg-white border border-stone-200 rounded-2xl shadow-xs flex items-center justify-between text-xs font-semibold text-stone-700 hover:border-[#DA6868] active:scale-95 transition"
          >
            <div className="flex items-center gap-2">
              <Palette className="w-4 h-4 text-[#DA6868]" />
              <span>
                Desain:{' '}
                <strong className="text-[#DA6868]">
                  {selectedTemplate.name} ({selectedLayout === 'grid' ? 'Grid 2×2' : selectedLayout === 'strip3' ? '1×3' : '1×4'})
                </strong>
              </span>
            </div>
            <span className="text-[11px] text-stone-400">Pilih Desain →</span>
          </button>

          <div className="w-full mt-3">
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
                ? `Mengambil Foto (${currentShot}/${totalShotsRequired})...`
                : isGeneratingStrip
                ? 'Menyusun Foto...'
                : `Mulai Foto (${totalShotsRequired} Jepretan)`}
            </button>
            <p className="text-center text-xs text-slate-500 mt-2">
              Kamera menghitung mundur 3 detik otomatis untuk setiap pose.
            </p>
          </div>
        </div>
      )}

      {/* Pratinjau Hasil */}
      {finalStripUrl && (
        <div className="w-full max-w-md flex flex-col items-center animate-fade-in">
          <div className="flex items-center gap-2 text-stone-600 mb-2 text-sm font-semibold">
            <Sparkles className="w-4 h-4 text-[#DA6868]" />
            Hasil Fotomu Sudah Jadi!
          </div>

          <button
            onClick={() => setIsTemplateModalOpen(true)}
            className="w-full mb-3 py-2.5 px-4 bg-white border border-stone-200 rounded-2xl shadow-xs flex items-center justify-between text-xs font-semibold text-stone-700 hover:border-[#DA6868] active:scale-95 transition"
          >
            <div className="flex items-center gap-2">
              <Palette className="w-4 h-4 text-[#DA6868]" />
              <span>
                Ganti Frame:{' '}
                <strong className="text-[#DA6868]">{selectedTemplate.name}</strong>
              </span>
            </div>
            <span className="text-[11px] text-stone-400">Ubah Desain →</span>
          </button>

          {/* Tab Filter & Stiker */}
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
              Pilihan Filter
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

          {activeTab === 'filter' && (
            <div className="w-full flex items-center justify-center gap-1.5 bg-white px-3 py-2 rounded-2xl shadow-xs border border-stone-200 mb-3 animate-fade-in">
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
          )}

          {activeTab === 'stiker' && (
            <div className="w-full bg-white p-3 rounded-2xl shadow-xs border border-stone-200 mb-3 animate-fade-in">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-semibold text-stone-600">
                  Ketuk emoji untuk menempel ke strip:
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

              {currentSelectedSticker && (
                <div className="bg-rose-50/70 p-2 rounded-xl border border-rose-100 flex items-center justify-between">
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
                    >
                      <ZoomOut className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => adjustStickerScale(currentSelectedSticker.id, 0.2)}
                      className="p-1.5 bg-white text-stone-700 rounded-lg border border-stone-200 hover:bg-stone-50 active:scale-95 transition"
                    >
                      <ZoomIn className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Kotak Pengaturan Catatan Interaktif */}
          <div className="w-full bg-white p-3.5 rounded-2xl shadow-xs border border-stone-200 mb-3">
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-stone-600">
                Pesan Pribadi / Catatan Singkat:
              </label>
              <span className="text-[10px] text-stone-400">Geser teks langsung di foto</span>
            </div>
            <input
              type="text"
              maxLength={40}
              placeholder="Contoh: Me Time, Liburan Sendiri..."
              value={customNote}
              onChange={(e) => handleNoteChange(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-stone-200 focus:outline-none focus:border-[#DA6868] text-stone-700 placeholder:text-stone-400 mb-2.5"
            />

            {/* Pilihan Susunan Teks (Left, Center, Right) */}
            <div className="flex items-center justify-between mb-2.5 pb-2 border-b border-stone-100">
              <div className="flex items-center gap-1">
                <span className="text-[11px] font-medium text-stone-400 mr-1">Susunan:</span>
                <button
                  type="button"
                  onClick={() => handleAlignChange('left')}
                  className={`p-1.5 rounded-lg border transition ${
                    noteAlign === 'left'
                      ? 'bg-rose-50 text-[#DA6868] border-rose-200'
                      : 'bg-stone-50 text-stone-500 border-stone-100'
                  }`}
                  title="Rata Kiri"
                >
                  <AlignLeft className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => handleAlignChange('center')}
                  className={`p-1.5 rounded-lg border transition ${
                    noteAlign === 'center'
                      ? 'bg-rose-50 text-[#DA6868] border-rose-200'
                      : 'bg-stone-50 text-stone-500 border-stone-100'
                  }`}
                  title="Rata Tengah"
                >
                  <AlignCenter className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => handleAlignChange('right')}
                  className={`p-1.5 rounded-lg border transition ${
                    noteAlign === 'right'
                      ? 'bg-rose-50 text-[#DA6868] border-rose-200'
                      : 'bg-stone-50 text-stone-500 border-stone-100'
                  }`}
                  title="Rata Kanan"
                >
                  <AlignRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Ukuran Teks */}
              <div className="flex items-center gap-1">
                <span className="text-[11px] font-medium text-stone-400 mr-1">
                  Ukuran: {Math.round(notePos.scale * 100)}%
                </span>
                <button
                  type="button"
                  onClick={() => adjustNoteScale(-0.15)}
                  className="p-1.5 bg-stone-50 text-stone-700 rounded-lg border border-stone-150 hover:bg-stone-100 transition active:scale-95"
                >
                  <ZoomOut className="w-3 h-3" />
                </button>
                <button
                  type="button"
                  onClick={() => adjustNoteScale(0.15)}
                  className="p-1.5 bg-stone-50 text-stone-700 rounded-lg border border-stone-150 hover:bg-stone-100 transition active:scale-95"
                >
                  <ZoomIn className="w-3 h-3" />
                </button>
              </div>
            </div>

            {/* Pilihan Font */}
            <div className="flex items-center gap-1.5 mb-2.5 overflow-x-auto pb-1">
              <span className="text-[11px] font-medium text-stone-400 shrink-0">Font:</span>
              {NOTE_FONTS.map((f) => (
                <button
                  key={f.id}
                  onClick={() => handleFontChange(f.family)}
                  className={`px-2.5 py-1 rounded-lg text-xs transition shrink-0 ${
                    noteFont === f.family
                      ? 'bg-rose-50 text-[#DA6868] font-bold border border-rose-200'
                      : 'bg-stone-50 text-stone-600 border border-stone-100'
                  }`}
                  style={{ fontFamily: f.family }}
                >
                  {f.name}
                </button>
              ))}
            </div>

            {/* Pilihan Warna */}
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-medium text-stone-400 shrink-0">Warna:</span>
              <div className="flex items-center gap-1.5">
                {NOTE_COLORS.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => handleColorChange(c.value)}
                    className={`w-6 h-6 rounded-full border-2 transition active:scale-95 ${
                      noteColor === c.value ? 'border-stone-800 scale-110 shadow-xs' : 'border-white'
                    }`}
                    style={{ backgroundColor: c.value }}
                    title={c.name}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Pratinjau Kertas Strip Interaktif */}
          <div
            ref={previewContainerRef}
            onClick={() => setSelectedStickerId(null)}
            className={`relative select-none p-3 bg-white rounded-2xl shadow-2xl border border-stone-200 touch-pan-y ${
              selectedLayout === 'grid'
                ? 'max-w-[320px]'
                : selectedLayout === 'strip3'
                ? 'max-w-[250px]'
                : 'max-w-[280px]'
            }`}
          >
            {/* eslint-disable-next-html-element/no-img-element */}
            <img
              src={finalStripUrl}
              alt="Hasil Photobooth"
              className="w-full h-auto rounded-lg shadow-inner pointer-events-none select-none touch-pan-y"
            />

            {/* Elemen Catatan Singkat Bebas Geser & Ubah Ukuran dengan Jari */}
            {customNote.trim() && (
              <div
                onPointerDown={handleNotePointerDown}
                onPointerMove={handleNotePointerMove}
                onPointerUp={handleNotePointerUp}
                onPointerCancel={handleNotePointerUp}
                style={{
                  left: `${notePos.x}%`,
                  top: `${notePos.y}%`,
                  transform: `translate(-50%, -50%) scale(${notePos.scale})`,
                  color: noteColor,
                  fontFamily: noteFont,
                  textAlign: noteAlign,
                }}
                className={`absolute select-none touch-none cursor-grab active:cursor-grabbing p-1.5 rounded-xl border-2 border-dashed border-[#DA6868]/70 bg-white/40 backdrop-blur-[1px] whitespace-nowrap z-28 transition-shadow ${
                  isDraggingNote ? 'shadow-xl scale-105' : 'shadow-xs'
                }`}
              >
                <span className="font-semibold text-xs leading-none">“{customNote}”</span>

                {/* Tuas Perbesar/Perkecil di Sudut Catatan */}
                <div
                  onPointerDown={handleNoteResizeDown}
                  onPointerMove={handleNoteResizeMove}
                  onPointerUp={handleNoteResizeUp}
                  onPointerCancel={handleNoteResizeUp}
                  className="absolute -bottom-2 -right-2 w-4 h-4 bg-[#DA6868] text-white rounded-full flex items-center justify-center cursor-se-resize shadow-md active:scale-125 touch-none"
                >
                  <Maximize2 className="w-2.5 h-2.5" />
                </div>
              </div>
            )}

            {/* Stiker Interaktif */}
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
                    <button
                      type="button"
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={(e) => handleRemoveSticker(stk.id, e)}
                      className="absolute -top-2 -right-2 bg-stone-900/80 text-white rounded-full p-0.5 hover:bg-red-500 transition shadow-sm"
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>
                    <div
                      onPointerDown={(e) => handleResizeHandleDown(e, stk.id, scale)}
                      onPointerMove={handleResizeHandleMove}
                      onPointerUp={handleResizeHandleUp}
                      onPointerCancel={handleResizeHandleUp}
                      className="absolute -bottom-2 -right-2 w-5 h-5 bg-[#DA6868] text-white rounded-full flex items-center justify-center cursor-se-resize shadow-md active:scale-125 touch-none"
                    >
                      <Maximize2 className="w-2.5 h-2.5" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

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

      {/* Modal Katalog Frame */}
      <TemplateSelectorModal
        isOpen={isTemplateModalOpen}
        onClose={() => setIsTemplateModalOpen(false)}
        selectedTemplateId={selectedTemplate.id}
        selectedLayout={selectedLayout}
        onSelectLayout={(layout) => {
          setSelectedLayout(layout);
          if (capturedPhotos.length > 0) {
            generatePhotoStrip(
              capturedPhotos,
              selectedTemplate,
              selectedFilter,
              customNote,
              layout,
              placedStickers,
              noteFont,
              noteColor,
              noteAlign,
              notePos
            );
          }
        }}
        onSelectTemplate={(tpl) => {
          setSelectedTemplate(tpl);
          if (capturedPhotos.length > 0) {
            generatePhotoStrip(
              capturedPhotos,
              tpl,
              selectedFilter,
              customNote,
              selectedLayout,
              placedStickers,
              noteFont,
              noteColor,
              noteAlign,
              notePos
            );
          }
        }}
      />
    </main>
  );
}