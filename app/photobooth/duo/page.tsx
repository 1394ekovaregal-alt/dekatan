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
  Copy,
  Check,
  Users,
  Mic,
  MicOff,
  Palette,
  Play,
  SlidersHorizontal,
  Crop,
  Undo2,
  Redo2,
  Move,
  RotateCcw,
  Maximize2,
  ZoomIn,
  ZoomOut,
  AlignLeft,
  AlignCenter,
  AlignRight,
} from 'lucide-react';
import type { DataConnection, MediaConnection } from 'peerjs';
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

export interface PhotoAdjustment {
  panX: number;
  panY: number;
  zoom: number;
}

const DEFAULT_ADJUSTMENTS: PhotoAdjustment[] = [
  { panX: 0, panY: 0, zoom: 1 },
  { panX: 0, panY: 0, zoom: 1 },
  { panX: 0, panY: 0, zoom: 1 },
  { panX: 0, panY: 0, zoom: 1 },
];

// Deteksi Lubang Transparan Otomatis pada PNG Bingkai
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
      while (leftX > 10 && getAlpha(leftX, midY) < 100) leftX--;
      let rightX = centerX;
      while (rightX < targetW - 10 && getAlpha(rightX, midY) < 100) rightX++;

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

export default function DuoPhotobooth() {
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);

  const localStreamRef = useRef<MediaStream | null>(null);
  const peerRef = useRef<any>(null);
  const connRef = useRef<DataConnection | null>(null);
  const callRef = useRef<MediaConnection | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const previewContainerRef = useRef<HTMLDivElement | null>(null);

  // Koneksi
  const [peerId, setPeerId] = useState<string>('');
  const [targetPeerId, setTargetPeerId] = useState<string>('');
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [isCopied, setIsCopied] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string>('Menyiapkan koneksi...');

  // Kamera & Audio
  const [cameraReady, setCameraReady] = useState(false);
  const [isMicMuted, setIsMicMuted] = useState<boolean>(false);

  // Template & Tata Letak
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<FrameTemplate>(FRAME_TEMPLATES[0]);
  const selectedTemplateRef = useRef<FrameTemplate>(FRAME_TEMPLATES[0]);

  const [selectedLayout, setSelectedLayout] = useState<LayoutMode>('strip4');
  const selectedLayoutRef = useRef<LayoutMode>('strip4');

  const [selectedFilter, setSelectedFilter] = useState<PhotoFilterKey>('normal');
  const selectedFilterRef = useRef<PhotoFilterKey>('normal');

  // Tab Menu Pratinjau
  const [activeTab, setActiveTab] = useState<'filter' | 'crop'>('filter');

  // Penyesuaian Foto, Crop, & Riwayat Undo/Redo
  const [photoAdjustments, setPhotoAdjustments] = useState<PhotoAdjustment[]>(DEFAULT_ADJUSTMENTS);
  const photoAdjustmentsRef = useRef<PhotoAdjustment[]>(DEFAULT_ADJUSTMENTS);
  const [history, setHistory] = useState<PhotoAdjustment[][]>([DEFAULT_ADJUSTMENTS]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState<number>(0);
  const [renderedSlots, setRenderedSlots] = useState<{ xPct: number; yPct: number; wPct: number; hPct: number }[]>([]);

  // Dragging Foto Manual
  const [dragPhotoState, setDragPhotoState] = useState<{
    index: number;
    startX: number;
    startY: number;
    initialPanX: number;
    initialPanY: number;
  } | null>(null);

  // Catatan, Font, Warna, Susunan, & Posisi Jari
  const [customNote, setCustomNote] = useState<string>('');
  const customNoteRef = useRef<string>('');
  const [noteFont, setNoteFont] = useState<string>('sans-serif');
  const noteFontRef = useRef<string>('sans-serif');
  const [noteColor, setNoteColor] = useState<string>('#DA6868');
  const noteColorRef = useRef<string>('#DA6868');
  const [noteAlign, setNoteAlign] = useState<TextAlign>('center');
  const noteAlignRef = useRef<TextAlign>('center');
  const [notePos, setNotePos] = useState<{ x: number; y: number; scale: number }>({
    x: 50,
    y: 86,
    scale: 1.0,
  });
  const notePosRef = useRef<{ x: number; y: number; scale: number }>({
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

  // Status Jepret
  const [isCapturing, setIsCapturing] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [currentShot, setCurrentShot] = useState(0);
  const [capturedPhotos, setCapturedPhotos] = useState<string[]>([]);
  const capturedPhotosRef = useRef<string[]>([]);
  const [finalStripUrl, setFinalStripUrl] = useState<string | null>(null);
  const [isGeneratingStrip, setIsGeneratingStrip] = useState(false);
  const [showFlash, setShowFlash] = useState(false);

  useEffect(() => {
    capturedPhotosRef.current = capturedPhotos;
  }, [capturedPhotos]);

  useEffect(() => {
    selectedTemplateRef.current = selectedTemplate;
  }, [selectedTemplate]);

  useEffect(() => {
    selectedLayoutRef.current = selectedLayout;
  }, [selectedLayout]);

  useEffect(() => {
    selectedFilterRef.current = selectedFilter;
  }, [selectedFilter]);

  useEffect(() => {
    customNoteRef.current = customNote;
  }, [customNote]);

  useEffect(() => {
    noteFontRef.current = noteFont;
  }, [noteFont]);

  useEffect(() => {
    noteColorRef.current = noteColor;
  }, [noteColor]);

  useEffect(() => {
    noteAlignRef.current = noteAlign;
  }, [noteAlign]);

  useEffect(() => {
    notePosRef.current = notePos;
  }, [notePos]);

  useEffect(() => {
    photoAdjustmentsRef.current = photoAdjustments;
  }, [photoAdjustments]);

  const initAudio = useCallback(() => {
    if (!audioCtxRef.current) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) audioCtxRef.current = new AudioCtx();
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
      for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

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

  const startLocalMedia = useCallback(async () => {
    try {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t) => t.stop());
      }

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 960 } },
          audio: { echoCancellation: true, noiseSuppression: true },
        });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      }

      localStreamRef.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
        localVideoRef.current.onloadedmetadata = () => {
          localVideoRef.current?.play().catch(() => {});
        };
      }
      setCameraReady(true);
      return stream;
    } catch (err) {
      setStatusMessage('Gagal mengakses kamera/mikrofon.');
      return null;
    }
  }, []);

  const toggleMic = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMicMuted(!audioTrack.enabled);
      }
    }
  };

  const generateDuoStrip = useCallback(
    async (
      photos: string[],
      template: FrameTemplate = selectedTemplateRef.current,
      filterKey: PhotoFilterKey = selectedFilterRef.current,
      note: string = customNoteRef.current,
      layout: LayoutMode = selectedLayoutRef.current,
      currentFont: string = noteFontRef.current,
      currentColor: string = noteColorRef.current,
      currentAlign: TextAlign = noteAlignRef.current,
      currentPos: { x: number; y: number; scale: number } = notePosRef.current,
      adjustments: PhotoAdjustment[] = photoAdjustmentsRef.current
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
        radius: number = 0,
        adj: PhotoAdjustment = { panX: 0, panY: 0, zoom: 1 }
      ) => {
        const imgRatio = img.width / img.height;
        const targetRatio = w / h;
        let baseW = img.width;
        let baseH = img.height;

        if (imgRatio > targetRatio) {
          baseW = img.height * targetRatio;
        } else {
          baseH = img.width / targetRatio;
        }

        const currentZoom = Math.max(1, adj.zoom || 1);
        const sWidth = baseW / currentZoom;
        const sHeight = baseH / currentZoom;

        const defaultSx = (img.width - sWidth) / 2;
        const defaultSy = (img.height - sHeight) * 0.18;

        const maxPanX = (img.width - sWidth) / 2;
        const maxPanY = (img.height - sHeight) / 2;

        const sx = Math.max(0, Math.min(img.width - sWidth, defaultSx + adj.panX * maxPanX));
        const sy = Math.max(0, Math.min(img.height - sHeight, defaultSy + adj.panY * maxPanY));

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

      const calculatedSlots: { xPct: number; yPct: number; wPct: number; hPct: number }[] = [];

      // ================= 1. TEMPLATE ADMIN (PNG OVERLAY) =================
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
            const adj = adjustments[i] || { panX: 0, panY: 0, zoom: 1 };
            drawCoverImage(img, slot.x, slot.y, slot.width, slot.height, 4, adj);

            calculatedSlots.push({
              xPct: (slot.x / W) * 100,
              yPct: (slot.y / H) * 100,
              wPct: (slot.width / W) * 100,
              hPct: (slot.height / H) * 100,
            });
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
            const adj = adjustments[i] || { panX: 0, panY: 0, zoom: 1 };
            drawCoverImage(img, posX, y, photoW, photoH, 6, adj);

            calculatedSlots.push({
              xPct: (posX / W) * 100,
              yPct: (y / H) * 100,
              wPct: (photoW / W) * 100,
              hPct: (photoH / H) * 100,
            });
          }
        }

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
          .toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
          .replace(':', '.');

        const dateTextY = logoY + logoH + (isStory916 ? 24 : 16);
        ctx.font = isStory916 ? '500 18px sans-serif' : '500 12px sans-serif';
        ctx.fillStyle = isDarkTheme ? 'rgba(255, 255, 255, 0.85)' : '#64748B';
        ctx.textAlign = 'center';
        ctx.fillText(`${formattedDate} • ${formattedTime} WITA`, W / 2, dateTextY);

        if (note.trim()) {
          const pixelX = (currentPos.x / 100) * W;
          const pixelY = (currentPos.y / 100) * H;
          const baseSize = isStory916 ? 24 : 16;
          const dynamicSize = Math.round(baseSize * currentPos.scale);

          ctx.font = `600 ${dynamicSize}px ${currentFont}`;
          ctx.fillStyle = currentColor;
          ctx.textAlign = currentAlign;
          ctx.textBaseline = 'middle';
          ctx.fillText(`“${note.trim()}”`, pixelX, pixelY);
        }
      } else {
        // ================= 2. TEMPLATE STANDAR =================
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
          photoHeight = Math.round(photoWidth * (3 / 4));
          totalHeight = padding * 2 + photoHeight * 2 + spacing + footerHeight;
        } else if (isStrip3) {
          stripWidth = 560;
          photoWidth = stripWidth - padding * 2;
          photoHeight = Math.round(photoWidth * (3 / 4));
          totalHeight = padding * 2 + photoHeight * 3 + spacing * 2 + footerHeight;
        } else {
          stripWidth = 560;
          photoWidth = stripWidth - padding * 2;
          photoHeight = Math.round(photoWidth * (3 / 4));
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

          const adj = adjustments[i] || { panX: 0, panY: 0, zoom: 1 };
          drawCoverImage(img, xPos, yPos, photoWidth, photoHeight, 8, adj);

          calculatedSlots.push({
            xPct: (xPos / stripWidth) * 100,
            yPct: (yPos / totalHeight) * 100,
            wPct: (photoWidth / stripWidth) * 100,
            hPct: (photoHeight / totalHeight) * 100,
          });

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
          .toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
          .replace(':', '.');

        const currentTextY = logoY + logoHeight + 24;
        ctx.font = '500 13px sans-serif';
        ctx.fillStyle = template.subTextColor;
        ctx.textAlign = 'center';
        ctx.fillText(`${formattedDate} • ${formattedTime} WITA`, stripWidth / 2, currentTextY);

        ctx.font = '700 12px sans-serif';
        ctx.fillStyle = template.textColor;
        ctx.fillText(template.labelFooter || 'DEKATAN DUO', stripWidth / 2, currentTextY + 20);

        if (note.trim()) {
          const pixelX = (currentPos.x / 100) * stripWidth;
          const pixelY = (currentPos.y / 100) * totalHeight;
          const dynamicSize = Math.round(16 * currentPos.scale);

          ctx.font = `600 ${dynamicSize}px ${currentFont}`;
          ctx.fillStyle = currentColor;
          ctx.textAlign = currentAlign;
          ctx.textBaseline = 'middle';
          ctx.fillText(`“${note.trim()}”`, pixelX, pixelY);
        }
      }

      setRenderedSlots(calculatedSlots);
      const dataUrl = canvas.toDataURL('image/png');
      setFinalStripUrl(dataUrl);
      setIsGeneratingStrip(false);
    },
    []
  );

  // Fungsi Kelola Riwayat Undo & Redo (Tersinkron Berdua)
  const commitAdjustment = (newAdjustments: PhotoAdjustment[], broadcast: boolean = true) => {
    const updatedHistory = history.slice(0, historyIndex + 1);
    updatedHistory.push(newAdjustments);
    setHistory(updatedHistory);
    setHistoryIndex(updatedHistory.length - 1);
    setPhotoAdjustments(newAdjustments);
    photoAdjustmentsRef.current = newAdjustments;

    if (capturedPhotos.length > 0) {
      generateDuoStrip(
        capturedPhotos,
        selectedTemplate,
        selectedFilter,
        customNote,
        selectedLayout,
        noteFont,
        noteColor,
        noteAlign,
        notePos,
        newAdjustments
      );
    }

    if (broadcast && connRef.current) {
      connRef.current.send({ type: 'ADJUSTMENTS_CHANGE', adjustments: newAdjustments });
    }
  };

  const handleUndo = () => {
    if (historyIndex > 0) {
      const targetIndex = historyIndex - 1;
      setHistoryIndex(targetIndex);
      const targetState = history[targetIndex];
      setPhotoAdjustments(targetState);
      photoAdjustmentsRef.current = targetState;

      if (capturedPhotos.length > 0) {
        generateDuoStrip(
          capturedPhotos,
          selectedTemplate,
          selectedFilter,
          customNote,
          selectedLayout,
          noteFont,
          noteColor,
          noteAlign,
          notePos,
          targetState
        );
      }
      if (connRef.current) {
        connRef.current.send({ type: 'ADJUSTMENTS_CHANGE', adjustments: targetState });
      }
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      const targetIndex = historyIndex + 1;
      setHistoryIndex(targetIndex);
      const targetState = history[targetIndex];
      setPhotoAdjustments(targetState);
      photoAdjustmentsRef.current = targetState;

      if (capturedPhotos.length > 0) {
        generateDuoStrip(
          capturedPhotos,
          selectedTemplate,
          selectedFilter,
          customNote,
          selectedLayout,
          noteFont,
          noteColor,
          noteAlign,
          notePos,
          targetState
        );
      }
      if (connRef.current) {
        connRef.current.send({ type: 'ADJUSTMENTS_CHANGE', adjustments: targetState });
      }
    }
  };

  const handleResetSlot = (index: number) => {
    const updated = photoAdjustments.map((adj, i) =>
      i === index ? { panX: 0, panY: 0, zoom: 1 } : adj
    );
    commitAdjustment(updated);
  };

  const handleZoomChange = (index: number, step: number) => {
    const current = photoAdjustments[index] || { panX: 0, panY: 0, zoom: 1 };
    const nextZoom = Math.max(1, Math.min(2.5, Number((current.zoom + step).toFixed(2))));
    const updated = photoAdjustments.map((adj, i) =>
      i === index ? { ...adj, zoom: nextZoom } : adj
    );
    commitAdjustment(updated);
  };

  // Drag Gesture pada Masing-Masing Foto Duo
  const handlePhotoDragStart = (e: React.PointerEvent, index: number) => {
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setSelectedPhotoIndex(index);
    const current = photoAdjustments[index] || { panX: 0, panY: 0, zoom: 1 };
    setDragPhotoState({
      index,
      startX: e.clientX,
      startY: e.clientY,
      initialPanX: current.panX,
      initialPanY: current.panY,
    });
  };

  const handlePhotoDragMove = (e: React.PointerEvent) => {
    if (!dragPhotoState) return;
    e.stopPropagation();
    const deltaX = (e.clientX - dragPhotoState.startX) * 0.008;
    const deltaY = (e.clientY - dragPhotoState.startY) * 0.008;

    const newPanX = Math.max(-1, Math.min(1, dragPhotoState.initialPanX - deltaX));
    const newPanY = Math.max(-1, Math.min(1, dragPhotoState.initialPanY - deltaY));

    const updated = photoAdjustments.map((adj, i) =>
      i === dragPhotoState.index ? { ...adj, panX: newPanX, panY: newPanY } : adj
    );
    setPhotoAdjustments(updated);
    photoAdjustmentsRef.current = updated;

    if (capturedPhotos.length > 0) {
      generateDuoStrip(
        capturedPhotos,
        selectedTemplate,
        selectedFilter,
        customNote,
        selectedLayout,
        noteFont,
        noteColor,
        noteAlign,
        notePos,
        updated
      );
    }
  };

  const handlePhotoDragEnd = (e: React.PointerEvent) => {
    if (!dragPhotoState) return;
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch (_) {}
    commitAdjustment(photoAdjustments);
    setDragPhotoState(null);
  };

  const captureDuoFrame = (): string => {
    const localVideo = localVideoRef.current;
    const remoteVideo = remoteVideoRef.current;
    if (!localVideo || !remoteVideo) return '';

    const canvas = document.createElement('canvas');
    canvas.width = 1000;
    canvas.height = 750;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';

    const halfW = canvas.width / 2;

    const drawVideoCover = (
      video: HTMLVideoElement,
      targetX: number,
      targetY: number,
      targetW: number,
      targetH: number,
      mirror: boolean = false
    ) => {
      const vW = video.videoWidth || 640;
      const vH = video.videoHeight || 480;
      const vRatio = vW / vH;
      const tRatio = targetW / targetH;
      let sW = vW;
      let sH = vH;
      let sx = 0;
      let sy = 0;

      if (vRatio > tRatio) {
        sW = vH * tRatio;
        sx = (vW - sW) / 2;
      } else {
        sH = vW / tRatio;
        sy = (vH - sH) / 2;
      }

      ctx.save();
      if (mirror) {
        ctx.translate(targetX + targetW, targetY);
        ctx.scale(-1, 1);
        ctx.drawImage(video, sx, sy, sW, sH, 0, 0, targetW, targetH);
      } else {
        ctx.drawImage(video, sx, sy, sW, sH, targetX, targetY, targetW, targetH);
      }
      ctx.restore();
    };

    drawVideoCover(localVideo, 0, 0, halfW, canvas.height, true);
    drawVideoCover(remoteVideo, halfW, 0, halfW, canvas.height, false);

    ctx.strokeStyle = '#FAF7F2';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(halfW, 0);
    ctx.lineTo(halfW, canvas.height);
    ctx.stroke();

    return canvas.toDataURL('image/jpeg', 0.95);
  };

  const executePhotoSession = useCallback(async () => {
    initAudio();
    setIsCapturing(true);
    setCapturedPhotos([]);
    setFinalStripUrl(null);
    setPhotoAdjustments(DEFAULT_ADJUSTMENTS);
    photoAdjustmentsRef.current = DEFAULT_ADJUSTMENTS;
    setHistory([DEFAULT_ADJUSTMENTS]);
    setHistoryIndex(0);

    const tempPhotos: string[] = [];
    const totalShots = selectedLayoutRef.current === 'strip3' ? 3 : 4;

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

      const combinedFrame = captureDuoFrame();
      tempPhotos.push(combinedFrame);
      setCapturedPhotos([...tempPhotos]);
      setTimeout(() => setShowFlash(false), 200);

      if (shot < totalShots) {
        await new Promise((resolve) => setTimeout(resolve, 1400));
      }
    }

    setIsCapturing(false);
    generateDuoStrip(
      tempPhotos,
      selectedTemplateRef.current,
      selectedFilterRef.current,
      customNoteRef.current,
      selectedLayoutRef.current,
      noteFontRef.current,
      noteColorRef.current,
      noteAlignRef.current,
      notePosRef.current,
      DEFAULT_ADJUSTMENTS
    );
  }, [initAudio, playBeepSound, playShutterSound, generateDuoStrip]);

  // Sinkronisasi Sinyal Dua Arah Antar-Perangkat
  const setupDataConnection = useCallback(
    (conn: DataConnection) => {
      conn.on('open', () => {
        setIsConnected(true);
        setStatusMessage('Terhubung! Silakan pilih template bersama.');
      });

      conn.on('data', (data: any) => {
        if (data?.type === 'START_COUNTDOWN') {
          executePhotoSession();
        } else if (
          data?.type === 'LAYOUT_CHANGE' &&
          (data?.layout === 'strip4' || data?.layout === 'strip3' || data?.layout === 'grid')
        ) {
          setSelectedLayout(data.layout);
          selectedLayoutRef.current = data.layout;
          if (capturedPhotosRef.current.length > 0) {
            generateDuoStrip(
              capturedPhotosRef.current,
              selectedTemplateRef.current,
              selectedFilterRef.current,
              customNoteRef.current,
              data.layout,
              noteFontRef.current,
              noteColorRef.current,
              noteAlignRef.current,
              notePosRef.current,
              photoAdjustmentsRef.current
            );
          }
        } else if (data?.type === 'TEMPLATE_CHANGE' && data?.template) {
          setSelectedTemplate(data.template);
          selectedTemplateRef.current = data.template;
          if (capturedPhotosRef.current.length > 0) {
            generateDuoStrip(
              capturedPhotosRef.current,
              data.template,
              selectedFilterRef.current,
              customNoteRef.current,
              selectedLayoutRef.current,
              noteFontRef.current,
              noteColorRef.current,
              noteAlignRef.current,
              notePosRef.current,
              photoAdjustmentsRef.current
            );
          }
        } else if (data?.type === 'FILTER_CHANGE' && data?.filter) {
          setSelectedFilter(data.filter);
          selectedFilterRef.current = data.filter;
          if (capturedPhotosRef.current.length > 0) {
            generateDuoStrip(
              capturedPhotosRef.current,
              selectedTemplateRef.current,
              data.filter,
              customNoteRef.current,
              selectedLayoutRef.current,
              noteFontRef.current,
              noteColorRef.current,
              noteAlignRef.current,
              notePosRef.current,
              photoAdjustmentsRef.current
            );
          }
        } else if (data?.type === 'NOTE_CHANGE' && typeof data?.note === 'string') {
          setCustomNote(data.note);
          customNoteRef.current = data.note;
          if (capturedPhotosRef.current.length > 0) {
            generateDuoStrip(
              capturedPhotosRef.current,
              selectedTemplateRef.current,
              selectedFilterRef.current,
              data.note,
              selectedLayoutRef.current,
              noteFontRef.current,
              noteColorRef.current,
              noteAlignRef.current,
              notePosRef.current,
              photoAdjustmentsRef.current
            );
          }
        } else if (data?.type === 'FONT_CHANGE' && typeof data?.font === 'string') {
          setNoteFont(data.font);
          noteFontRef.current = data.font;
          if (capturedPhotosRef.current.length > 0) {
            generateDuoStrip(
              capturedPhotosRef.current,
              selectedTemplateRef.current,
              selectedFilterRef.current,
              customNoteRef.current,
              selectedLayoutRef.current,
              data.font,
              noteColorRef.current,
              noteAlignRef.current,
              notePosRef.current,
              photoAdjustmentsRef.current
            );
          }
        } else if (data?.type === 'COLOR_CHANGE' && typeof data?.color === 'string') {
          setNoteColor(data.color);
          noteColorRef.current = data.color;
          if (capturedPhotosRef.current.length > 0) {
            generateDuoStrip(
              capturedPhotosRef.current,
              selectedTemplateRef.current,
              selectedFilterRef.current,
              customNoteRef.current,
              selectedLayoutRef.current,
              noteFontRef.current,
              data.color,
              noteAlignRef.current,
              notePosRef.current,
              photoAdjustmentsRef.current
            );
          }
        } else if (data?.type === 'ALIGN_CHANGE' && data?.align) {
          setNoteAlign(data.align);
          noteAlignRef.current = data.align;
          if (capturedPhotosRef.current.length > 0) {
            generateDuoStrip(
              capturedPhotosRef.current,
              selectedTemplateRef.current,
              selectedFilterRef.current,
              customNoteRef.current,
              selectedLayoutRef.current,
              noteFontRef.current,
              noteColorRef.current,
              data.align,
              notePosRef.current,
              photoAdjustmentsRef.current
            );
          }
        } else if (data?.type === 'POS_CHANGE' && data?.pos) {
          setNotePos(data.pos);
          notePosRef.current = data.pos;
          if (capturedPhotosRef.current.length > 0) {
            generateDuoStrip(
              capturedPhotosRef.current,
              selectedTemplateRef.current,
              selectedFilterRef.current,
              customNoteRef.current,
              selectedLayoutRef.current,
              noteFontRef.current,
              noteColorRef.current,
              noteAlignRef.current,
              data.pos,
              photoAdjustmentsRef.current
            );
          }
        } else if (data?.type === 'ADJUSTMENTS_CHANGE' && data?.adjustments) {
          setPhotoAdjustments(data.adjustments);
          photoAdjustmentsRef.current = data.adjustments;
          if (capturedPhotosRef.current.length > 0) {
            generateDuoStrip(
              capturedPhotosRef.current,
              selectedTemplateRef.current,
              selectedFilterRef.current,
              customNoteRef.current,
              selectedLayoutRef.current,
              noteFontRef.current,
              noteColorRef.current,
              noteAlignRef.current,
              notePosRef.current,
              data.adjustments
            );
          }
        }
      });
    },
    [executePhotoSession, generateDuoStrip]
  );

  useEffect(() => {
    let mounted = true;

    const initPeer = async () => {
      const stream = await startLocalMedia();
      if (!stream || !mounted) return;

      const { default: Peer } = await import('peerjs');
      const randomCode = Math.random().toString(36).substring(2, 8).toUpperCase();

      const peerInstance = new Peer(`dekatan-${randomCode}`, {
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
          ],
        },
      });

      peerInstance.on('open', (id) => {
        if (!mounted) return;
        setPeerId(id.replace('dekatan-', ''));
        setStatusMessage('Bagikan kode ke pasanganmu.');
      });

      peerInstance.on('call', (incomingCall) => {
        incomingCall.answer(stream);
        callRef.current = incomingCall;

        incomingCall.on('stream', (remoteStream) => {
          if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = remoteStream;
            remoteVideoRef.current.onloadedmetadata = () => {
              remoteVideoRef.current?.play().catch(() => {});
            };
          }
          setIsConnected(true);
          setStatusMessage('Pasangan tersambung! Atur strip kalian.');
        });
      });

      peerInstance.on('connection', (connection) => {
        connRef.current = connection;
        setupDataConnection(connection);
      });

      peerRef.current = peerInstance;
    };

    initPeer();

    return () => {
      mounted = false;
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t) => t.stop());
      }
      peerRef.current?.destroy();
    };
  }, [startLocalMedia, setupDataConnection]);

  const handleConnectToPartner = () => {
    if (!targetPeerId || !peerRef.current || !localStreamRef.current) return;
    setStatusMessage('Menyambungkan ke pasangan...');
    const fullTargetId = `dekatan-${targetPeerId.trim().toUpperCase()}`;

    const dataConn = peerRef.current.connect(fullTargetId);
    connRef.current = dataConn;
    setupDataConnection(dataConn);

    const mediaCall = peerRef.current.call(fullTargetId, localStreamRef.current);
    callRef.current = mediaCall;

    mediaCall.on('stream', (remoteStream: MediaStream) => {
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = remoteStream;
        remoteVideoRef.current.onloadedmetadata = () => {
          remoteVideoRef.current?.play().catch(() => {});
        };
      }
      setIsConnected(true);
      setStatusMessage('Berhasil tersambung!');
    });
  };

  const handleCopyCode = () => {
    if (!peerId) return;
    navigator.clipboard.writeText(peerId);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleLayoutChange = (newLayout: LayoutMode) => {
    setSelectedLayout(newLayout);
    selectedLayoutRef.current = newLayout;
    if (capturedPhotos.length > 0) {
      generateDuoStrip(
        capturedPhotos,
        selectedTemplate,
        selectedFilter,
        customNote,
        newLayout,
        noteFont,
        noteColor,
        noteAlign,
        notePos,
        photoAdjustments
      );
    }
    if (connRef.current) {
      connRef.current.send({ type: 'LAYOUT_CHANGE', layout: newLayout });
    }
  };

  const handleTemplateChange = (tpl: FrameTemplate) => {
    setSelectedTemplate(tpl);
    selectedTemplateRef.current = tpl;
    if (capturedPhotos.length > 0) {
      generateDuoStrip(
        capturedPhotos,
        tpl,
        selectedFilter,
        customNote,
        selectedLayout,
        noteFont,
        noteColor,
        noteAlign,
        notePos,
        photoAdjustments
      );
    }
    if (connRef.current) {
      connRef.current.send({ type: 'TEMPLATE_CHANGE', template: tpl });
    }
  };

  const handleTriggerSession = () => {
    initAudio();
    if (connRef.current) {
      connRef.current.send({ type: 'START_COUNTDOWN' });
    }
    executePhotoSession();
  };

  const handleFilterChange = (newFilter: PhotoFilterKey) => {
    setSelectedFilter(newFilter);
    selectedFilterRef.current = newFilter;
    if (capturedPhotos.length > 0) {
      generateDuoStrip(
        capturedPhotos,
        selectedTemplate,
        newFilter,
        customNote,
        selectedLayout,
        noteFont,
        noteColor,
        noteAlign,
        notePos,
        photoAdjustments
      );
    }
    if (connRef.current) {
      connRef.current.send({ type: 'FILTER_CHANGE', filter: newFilter });
    }
  };

  const handleNoteChange = (text: string) => {
    setCustomNote(text);
    customNoteRef.current = text;
    if (capturedPhotos.length > 0) {
      generateDuoStrip(
        capturedPhotos,
        selectedTemplate,
        selectedFilter,
        text,
        selectedLayout,
        noteFont,
        noteColor,
        noteAlign,
        notePos,
        photoAdjustments
      );
    }
    if (connRef.current) {
      connRef.current.send({ type: 'NOTE_CHANGE', note: text });
    }
  };

  const handleFontChange = (fontFamily: string) => {
    setNoteFont(fontFamily);
    noteFontRef.current = fontFamily;
    if (capturedPhotos.length > 0) {
      generateDuoStrip(
        capturedPhotos,
        selectedTemplate,
        selectedFilter,
        customNote,
        selectedLayout,
        fontFamily,
        noteColor,
        noteAlign,
        notePos,
        photoAdjustments
      );
    }
    if (connRef.current) {
      connRef.current.send({ type: 'FONT_CHANGE', font: fontFamily });
    }
  };

  const handleColorChange = (colorValue: string) => {
    setNoteColor(colorValue);
    noteColorRef.current = colorValue;
    if (capturedPhotos.length > 0) {
      generateDuoStrip(
        capturedPhotos,
        selectedTemplate,
        selectedFilter,
        customNote,
        selectedLayout,
        noteFont,
        colorValue,
        noteAlign,
        notePos,
        photoAdjustments
      );
    }
    if (connRef.current) {
      connRef.current.send({ type: 'COLOR_CHANGE', color: colorValue });
    }
  };

  const handleAlignChange = (align: TextAlign) => {
    setNoteAlign(align);
    noteAlignRef.current = align;
    if (capturedPhotos.length > 0) {
      generateDuoStrip(
        capturedPhotos,
        selectedTemplate,
        selectedFilter,
        customNote,
        selectedLayout,
        noteFont,
        noteColor,
        align,
        notePos,
        photoAdjustments
      );
    }
    if (connRef.current) {
      connRef.current.send({ type: 'ALIGN_CHANGE', align });
    }
  };

  const syncNotePosition = (pos: { x: number; y: number; scale: number }) => {
    setNotePos(pos);
    notePosRef.current = pos;
    if (connRef.current) {
      connRef.current.send({ type: 'POS_CHANGE', pos });
    }
  };

  const handleNotePointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setIsDraggingNote(true);
  };

  const handleNotePointerMove = (e: React.PointerEvent) => {
    if (!isDraggingNote || !previewContainerRef.current) return;
    e.stopPropagation();
    const rect = previewContainerRef.current.getBoundingClientRect();
    const touchX = e.clientX - rect.left;
    const touchY = e.clientY - rect.top;
    const pctX = Math.max(5, Math.min(95, (touchX / rect.width) * 100));
    const pctY = Math.max(5, Math.min(95, (touchY / rect.height) * 100));
    syncNotePosition({ ...notePosRef.current, x: pctX, y: pctY });
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
    syncNotePosition({ ...notePosRef.current, scale: newScale });
  };

  const handleNoteResizeUp = (e: React.PointerEvent) => {
    if (!noteResizeState) return;
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch (_) {}
    setNoteResizeState(null);
  };

  const adjustNoteScale = (step: number) => {
    const newScale = Math.max(
      0.6,
      Math.min(2.5, Number((notePosRef.current.scale + step).toFixed(2)))
    );
    syncNotePosition({ ...notePosRef.current, scale: newScale });
  };

  const handleDownload = async () => {
    if (!finalStripUrl) return;
    const fileName = `dekatan-duo-${selectedTemplate.id}-${Date.now()}.png`;

    try {
      const response = await fetch(finalStripUrl);
      const blob = await response.blob();
      const file = new File([blob], fileName, { type: 'image/png' });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: 'Foto Strip Dekatan Duo',
          text: 'Strip kenangan jarak jauh dari Dekatan Photobooth 💕',
        });
        return;
      }
    } catch (_) {}

    const link = document.createElement('a');
    link.download = fileName;
    link.href = finalStripUrl;
    link.click();
  };

  const handleRetake = () => {
    setFinalStripUrl(null);
    setCapturedPhotos([]);
    setCurrentShot(0);
    setPhotoAdjustments(DEFAULT_ADJUSTMENTS);
    photoAdjustmentsRef.current = DEFAULT_ADJUSTMENTS;
    setHistory([DEFAULT_ADJUSTMENTS]);
    setHistoryIndex(0);
  };

  const totalShotsRequired = selectedLayout === 'strip3' ? 3 : 4;
  const currentPhotoAdj = photoAdjustments[selectedPhotoIndex] || { panX: 0, panY: 0, zoom: 1 };

  return (
    <main className="min-h-screen bg-[#FAF7F2] text-[#264653] flex flex-col items-center px-4 py-5 md:py-8">
      {/* Header */}
      <div className="w-full max-w-2xl flex items-center justify-between mb-4">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs md:text-sm font-medium text-slate-600 hover:text-[#DA6868] transition"
        >
          <ArrowLeft className="w-4 h-4" />
          Keluar
        </Link>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 relative shrink-0 rounded-xl overflow-hidden shadow-xs">
            <Image src="/dekatan2.png" alt="Dekatan" fill className="object-contain" priority />
          </div>
          <span className="text-[11px] font-semibold tracking-wider text-[#DA6868] uppercase bg-rose-50 px-2.5 py-1 rounded-full border border-rose-100 flex items-center gap-1">
            <Users className="w-3 h-3" />
            Mode Berdua
          </span>
        </div>
      </div>

      {/* Tahap 1: Lobi Sambungan */}
      {!isConnected && !finalStripUrl && (
        <div className="w-full max-w-md bg-white rounded-3xl p-5 md:p-6 shadow-sm border border-stone-200 mb-5 animate-fade-in">
          <h2 className="text-sm md:text-base font-bold text-stone-800 mb-1">Sambungkan ke Pasangan</h2>
          <p className="text-xs text-stone-500 mb-4">{statusMessage}</p>

          <div className="bg-[#FAF7F2] p-3.5 rounded-2xl border border-stone-200 mb-4 flex items-center justify-between">
            <div>
              <div className="text-[11px] font-semibold text-stone-500 uppercase tracking-wide">
                Kode Bilikmu
              </div>
              <div className="text-xl font-mono font-bold text-[#DA6868] tracking-widest mt-0.5">
                {peerId || 'Membuat kode...'}
              </div>
            </div>
            <button
              onClick={handleCopyCode}
              disabled={!peerId}
              className="px-3 py-2 bg-white rounded-xl border border-stone-200 text-xs font-medium text-stone-600 hover:text-[#DA6868] active:scale-95 touch-manipulation flex items-center gap-1.5 transition"
            >
              {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5 text-stone-500" />}
              {isCopied ? 'Tersalin' : 'Salin'}
            </button>
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Masukkan kode pasangan"
              value={targetPeerId}
              onChange={(e) => setTargetPeerId(e.target.value.toUpperCase())}
              maxLength={6}
              className="flex-1 px-3.5 py-2.5 rounded-xl border border-stone-300 text-sm font-mono uppercase tracking-wider focus:outline-none focus:border-[#DA6868]"
            />
            <button
              onClick={handleConnectToPartner}
              disabled={!targetPeerId || targetPeerId.length < 4}
              className="px-5 py-2.5 bg-[#DA6868] text-white rounded-xl text-sm font-semibold hover:bg-[#c85656] disabled:opacity-50 active:scale-95 touch-manipulation transition"
            >
              Gabung
            </button>
          </div>
        </div>
      )}

      {/* Tahap 2: Live Camera & Pilihan Frame */}
      {!finalStripUrl && (
        <div className="w-full max-w-md flex flex-col items-center">
          <div className="relative w-full aspect-[4/3] bg-stone-900 rounded-3xl overflow-hidden shadow-xl border-4 border-white grid grid-cols-2 divide-x-2 divide-white/40">
            <div className="relative w-full h-full bg-stone-800 overflow-hidden">
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover -scale-x-100"
              />
              <span className="absolute bottom-2 left-2 bg-black/50 text-[10px] text-white px-2 py-0.5 rounded-md backdrop-blur-xs">
                Kamu
              </span>
            </div>

            <div className="relative w-full h-full bg-stone-800 overflow-hidden flex items-center justify-center">
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                className={`w-full h-full object-cover ${!isConnected ? 'hidden' : ''}`}
              />
              {!isConnected && (
                <div className="p-4 text-center text-stone-400 text-xs">
                  Menunggu pasangan bergabung...
                </div>
              )}
              {isConnected && (
                <span className="absolute bottom-2 left-2 bg-black/50 text-[10px] text-white px-2 py-0.5 rounded-md backdrop-blur-xs">
                  Pasangan
                </span>
              )}
            </div>

            {showFlash && <div className="absolute inset-0 bg-white animate-fade-out z-20" />}
            {countdown !== null && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/30 backdrop-blur-[2px] z-10">
                <span className="text-8xl font-black text-white drop-shadow-lg animate-pulse">
                  {countdown}
                </span>
              </div>
            )}
            {isCapturing && (
              <div className="absolute top-3 left-3 bg-black/60 backdrop-blur-md px-3 py-1 rounded-full text-white text-xs font-medium z-10">
                Foto {currentShot}/{totalShotsRequired}
              </div>
            )}
          </div>

          <div className="w-full flex items-center justify-between my-2.5 px-1">
            <div className="flex items-center gap-1.5">
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-400'
                }`}
              />
              <span className="text-xs font-medium text-stone-600">
                {isConnected ? 'Pasangan terhubung' : 'Menunggu koneksi...'}
              </span>
            </div>

            <button
              onClick={toggleMic}
              className={`px-3 py-1 rounded-xl text-xs font-medium flex items-center gap-1.5 touch-manipulation active:scale-95 transition ${
                isMicMuted
                  ? 'bg-red-50 text-red-600 border border-red-200'
                  : 'bg-emerald-50 text-emerald-600 border border-emerald-200'
              }`}
            >
              {isMicMuted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
              {isMicMuted ? 'Mic Mati' : 'Mic Nyala'}
            </button>
          </div>

          {isConnected && !isCapturing && (
            <button
              onClick={() => setIsTemplateModalOpen(true)}
              className="w-full mb-3 py-2.5 px-4 bg-white border border-stone-200 rounded-2xl shadow-xs flex items-center justify-between text-xs font-semibold text-stone-700 hover:border-[#DA6868] active:scale-95 transition animate-fade-in"
            >
              <div className="flex items-center gap-2">
                <Palette className="w-4 h-4 text-[#DA6868]" />
                <span>
                  Desain Frame:{' '}
                  <strong className="text-[#DA6868]">
                    {selectedTemplate.name} ({selectedLayout === 'grid' ? 'Grid 2×2' : selectedLayout === 'strip3' ? '1×3' : '1×4'})
                  </strong>
                </span>
              </div>
              <span className="text-[11px] bg-rose-50 text-[#DA6868] px-2 py-0.5 rounded-full font-medium border border-rose-100">
                Pilih Frame Bersama →
              </span>
            </button>
          )}

          <div className="w-full">
            <button
              onClick={handleTriggerSession}
              disabled={!isConnected || !cameraReady || isCapturing || isGeneratingStrip}
              className={`w-full py-4 rounded-2xl font-bold text-white shadow-lg flex items-center justify-center gap-2.5 touch-manipulation transition-all ${
                !isConnected || !cameraReady || isCapturing || isGeneratingStrip
                  ? 'bg-slate-400 cursor-not-allowed opacity-60'
                  : 'bg-[#DA6868] hover:bg-[#c85656] active:scale-[0.98]'
              }`}
            >
              {isCapturing ? (
                <>
                  <Camera className="w-5 h-5 animate-pulse" />
                  Mengambil Foto ({currentShot}/{totalShotsRequired})...
                </>
              ) : isGeneratingStrip ? (
                'Menyusun Strip Fotomu...'
              ) : isConnected ? (
                <>
                  <Play className="w-5 h-5 fill-white" />
                  Mulai Sesi ({totalShotsRequired} Foto)
                </>
              ) : (
                'Tunggu Pasangan Tersambung'
              )}
            </button>
            <p className="text-center text-xs text-slate-500 mt-2">
              Salah satu menekan tombol, hitungan mundur 3 detik berbunyi di kedua layar.
            </p>
          </div>
        </div>
      )}

      {/* Tahap 3: Pratinjau Strip Berdua */}
      {finalStripUrl && (
        <div className="w-full max-w-md flex flex-col items-center animate-fade-in">
          <div className="flex items-center gap-2 text-stone-600 mb-2.5 text-sm font-semibold">
            <Sparkles className="w-4 h-4 text-[#DA6868]" />
            Strip Foto Berdua Sudah Jadi!
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

          {/* Tab Filter | Atur Foto (Crop) */}
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
              Filter
            </button>

            <button
              onClick={() => setActiveTab('crop')}
              className={`flex-1 py-1.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition ${
                activeTab === 'crop'
                  ? 'bg-white text-[#DA6868] shadow-xs'
                  : 'text-stone-600 hover:text-stone-800'
              }`}
            >
              <Crop className="w-3.5 h-3.5" />
              Atur Foto Berdua
            </button>
          </div>

          {/* Tab 1: Filter Bar */}
          {activeTab === 'filter' && (
            <div className="flex items-center justify-center gap-1.5 mb-3 bg-white px-3 py-2 rounded-2xl shadow-xs border border-stone-200 w-full animate-fade-in">
              <SlidersHorizontal className="w-3.5 h-3.5 text-stone-500 mr-1" />
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

          {/* Tab 2: Penyesuaian Foto Duo (Crop, Geser, Undo & Redo) */}
          {activeTab === 'crop' && (
            <div className="w-full bg-white p-3.5 rounded-2xl shadow-xs border border-stone-200 mb-3 animate-fade-in">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-semibold text-stone-600">
                  Pilih foto & geser posisi wajah:
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={handleUndo}
                    disabled={historyIndex === 0}
                    className="p-1.5 rounded-lg border border-stone-200 text-stone-600 hover:bg-stone-50 disabled:opacity-30 disabled:cursor-not-allowed transition"
                    title="Undo"
                  >
                    <Undo2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={handleRedo}
                    disabled={historyIndex >= history.length - 1}
                    className="p-1.5 rounded-lg border border-stone-200 text-stone-600 hover:bg-stone-50 disabled:opacity-30 disabled:cursor-not-allowed transition"
                    title="Redo"
                  >
                    <Redo2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleResetSlot(selectedPhotoIndex)}
                    className="p-1.5 rounded-lg border border-stone-200 text-stone-600 hover:bg-stone-50 transition"
                    title="Reset Posisi Foto Ini"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Pemilih Kotak Foto 1-4 */}
              <div className="grid grid-cols-4 gap-1.5 mb-3">
                {capturedPhotos.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => setSelectedPhotoIndex(idx)}
                    className={`py-1.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 border ${
                      selectedPhotoIndex === idx
                        ? 'bg-rose-50 text-[#DA6868] border-[#DA6868]'
                        : 'bg-stone-50 text-stone-600 border-stone-100 hover:bg-stone-100'
                    }`}
                  >
                    <span>Foto {idx + 1}</span>
                  </button>
                ))}
              </div>

              {/* Pengaturan Zoom / Crop */}
              <div className="flex items-center justify-between bg-stone-50 p-2 rounded-xl border border-stone-150">
                <div className="flex items-center gap-1.5">
                  <Move className="w-3.5 h-3.5 text-stone-500" />
                  <span className="text-xs font-semibold text-stone-700">
                    Zoom: {Math.round(currentPhotoAdj.zoom * 100)}%
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => handleZoomChange(selectedPhotoIndex, -0.15)}
                    className="p-1.5 bg-white text-stone-700 rounded-lg border border-stone-200 hover:bg-stone-50 active:scale-95 transition"
                    title="Perkecil"
                  >
                    <ZoomOut className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleZoomChange(selectedPhotoIndex, 0.15)}
                    className="p-1.5 bg-white text-stone-700 rounded-lg border border-stone-200 hover:bg-stone-50 active:scale-95 transition"
                    title="Perbesar"
                  >
                    <ZoomIn className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <p className="text-[10px] text-stone-400 mt-2 text-center">
                Sentuh dan tarik foto di kotak bingkai di bawah untuk menggeser posisi berdua.
              </p>
            </div>
          )}

          {/* Kotak Pengaturan Catatan Interaktif Berdua */}
          <div className="w-full bg-white p-3.5 rounded-2xl shadow-xs border border-stone-200 mb-3">
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-stone-600">
                Catatan Berdua / Nama Kalian:
              </label>
              <span className="text-[10px] bg-rose-50 text-[#DA6868] px-2 py-0.5 rounded-full font-medium border border-rose-100">
                Tersinkron Berdua
              </span>
            </div>
            <input
              type="text"
              maxLength={40}
              placeholder="Contoh: Eko & Pasangan — Jarak Bukan Halangan"
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

          {/* Gambar Akhir dengan Wadah Interaktif */}
          <div
            ref={previewContainerRef}
            className={`relative select-none p-3 bg-white rounded-2xl shadow-2xl border border-stone-200 touch-pan-y ${
              selectedLayout === 'grid'
                ? 'max-w-[320px]'
                : selectedLayout === 'strip3'
                ? 'max-w-[250px]'
                : 'max-w-[280px]'
            }`}
          >
            {/* eslint-disable-next-html-element/no-img-element */}
            <img src={finalStripUrl} alt="Hasil Foto Berdua" className="w-full h-auto rounded-lg shadow-inner pointer-events-none select-none touch-pan-y" />

            {/* Area Sentuh Interaktif untuk Menggeser Masing-Masing Foto (Aktif saat tab Atur Foto dibuka) */}
            {activeTab === 'crop' &&
              renderedSlots.map((slot, idx) => {
                const isSelected = selectedPhotoIndex === idx;
                return (
                  <div
                    key={idx}
                    onPointerDown={(e) => handlePhotoDragStart(e, idx)}
                    onPointerMove={handlePhotoDragMove}
                    onPointerUp={handlePhotoDragEnd}
                    onPointerCancel={handlePhotoDragEnd}
                    style={{
                      left: `${slot.xPct}%`,
                      top: `${slot.yPct}%`,
                      width: `${slot.wPct}%`,
                      height: `${slot.hPct}%`,
                    }}
                    className={`absolute cursor-grab active:cursor-grabbing touch-none flex items-center justify-center transition-all ${
                      isSelected
                        ? 'border-2 border-dashed border-[#DA6868] bg-rose-500/10 z-25'
                        : 'border border-dashed border-white/40 bg-black/5 hover:border-[#DA6868]/60 z-20'
                    }`}
                  >
                    <span className="bg-black/60 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-md pointer-events-none backdrop-blur-xs">
                      Foto {idx + 1}
                    </span>
                  </div>
                );
              })}

            {/* Catatan Singkat Bebas Geser Dua Arah */}
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
          </div>

          <div className="w-full flex flex-col gap-3 mt-5">
            <button
              onClick={handleDownload}
              className="w-full py-3.5 bg-[#DA6868] text-white font-bold rounded-xl shadow-md hover:bg-[#c85656] active:scale-95 touch-manipulation flex items-center justify-center gap-2 transition"
            >
              <Download className="w-5 h-5" />
              Simpan / Bagikan Foto Strip ({selectedTemplate.name})
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
        onSelectLayout={(layout) => handleLayoutChange(layout)}
        onSelectTemplate={(tpl) => handleTemplateChange(tpl)}
      />
    </main>
  );
}