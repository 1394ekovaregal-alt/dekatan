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
  LayoutGrid,
  Rows,
} from 'lucide-react';
import type { DataConnection, MediaConnection } from 'peerjs';

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

export default function DuoPhotobooth() {
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);

  const localStreamRef = useRef<MediaStream | null>(null);
  const peerRef = useRef<any>(null);
  const connRef = useRef<DataConnection | null>(null);
  const callRef = useRef<MediaConnection | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  const [peerId, setPeerId] = useState<string>('');
  const [targetPeerId, setTargetPeerId] = useState<string>('');
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [isCopied, setIsCopied] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string>('Menyiapkan koneksi...');

  const [cameraReady, setCameraReady] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [currentShot, setCurrentShot] = useState(0);
  const [capturedPhotos, setCapturedPhotos] = useState<string[]>([]);
  const capturedPhotosRef = useRef<string[]>([]);
  const [finalStripUrl, setFinalStripUrl] = useState<string | null>(null);
  const [isGeneratingStrip, setIsGeneratingStrip] = useState(false);
  const [showFlash, setShowFlash] = useState(false);

  const [isMicMuted, setIsMicMuted] = useState<boolean>(false);

  const [selectedTheme, setSelectedTheme] = useState<FrameThemeKey>('white');
  const selectedThemeRef = useRef<FrameThemeKey>('white');

  const [selectedFilter, setSelectedFilter] = useState<PhotoFilterKey>('normal');
  const selectedFilterRef = useRef<PhotoFilterKey>('normal');

  const [selectedLayout, setSelectedLayout] = useState<LayoutMode>('strip4');
  const selectedLayoutRef = useRef<LayoutMode>('strip4');

  const [customNote, setCustomNote] = useState<string>('');
  const customNoteRef = useRef<string>('');

  useEffect(() => {
    capturedPhotosRef.current = capturedPhotos;
  }, [capturedPhotos]);

  useEffect(() => {
    selectedThemeRef.current = selectedTheme;
  }, [selectedTheme]);

  useEffect(() => {
    selectedFilterRef.current = selectedFilter;
  }, [selectedFilter]);

  useEffect(() => {
    selectedLayoutRef.current = selectedLayout;
  }, [selectedLayout]);

  useEffect(() => {
    customNoteRef.current = customNote;
  }, [customNote]);

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
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
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
      console.error('Akses media gagal:', err);
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
      themeKey: FrameThemeKey = selectedThemeRef.current,
      filterKey: PhotoFilterKey = selectedFilterRef.current,
      note: string = customNoteRef.current,
      layout: LayoutMode = selectedLayoutRef.current
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
        photoHeight = Math.round(photoWidth * (3 / 4));
        totalHeight = padding * 2 + photoHeight * 2 + spacing + footerHeight;
      } else if (isStrip3) {
        stripWidth = 560;
        photoWidth = stripWidth - padding * 2;
        photoHeight = Math.round(photoWidth * (3 / 4));
        totalHeight = padding * 2 + photoHeight * 3 + spacing * 2 + footerHeight;
      } else {
        // Default strip4 (1x4)
        stripWidth = 560;
        photoWidth = stripWidth - padding * 2;
        photoHeight = Math.round(photoWidth * (3 / 4));
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

        ctx.save();
        ctx.filter = PHOTO_FILTERS[filterKey].filter;
        ctx.drawImage(img, xPos, yPos, photoWidth, photoHeight);
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
          ? 'Duo Photobooth • Edisi Grid (2×2)'
          : isStrip3
          ? 'Duo Photobooth • Edisi Strip (1×3)'
          : 'Duo Photobooth • Edisi Strip (1×4)',
        stripWidth / 2,
        currentTextY + 20
      );

      const dataUrl = canvas.toDataURL('image/png');
      setFinalStripUrl(dataUrl);
      setIsGeneratingStrip(false);
    },
    []
  );

  const captureDuoFrame = (): string => {
    const localVideo = localVideoRef.current;
    const remoteVideo = remoteVideoRef.current;
    if (!localVideo || !remoteVideo) return '';

    const canvas = document.createElement('canvas');
    canvas.width = 1000;
    canvas.height = 750;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';

    const halfWidth = canvas.width / 2;

    ctx.save();
    ctx.translate(halfWidth, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(localVideo, 0, 0, halfWidth, canvas.height);
    ctx.restore();

    ctx.drawImage(remoteVideo, halfWidth, 0, halfWidth, canvas.height);

    ctx.strokeStyle = '#FAF7F2';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(halfWidth, 0);
    ctx.lineTo(halfWidth, canvas.height);
    ctx.stroke();

    return canvas.toDataURL('image/jpeg', 0.95);
  };

  const executePhotoSession = useCallback(async () => {
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

      const combinedFrame = captureDuoFrame();
      tempPhotos.push(combinedFrame);
      setCapturedPhotos([...tempPhotos]);
      setTimeout(() => setShowFlash(false), 200);

      if (shot < 4) {
        await new Promise((resolve) => setTimeout(resolve, 1400));
      }
    }

    setIsCapturing(false);
    generateDuoStrip(
      tempPhotos,
      selectedThemeRef.current,
      selectedFilterRef.current,
      customNoteRef.current,
      selectedLayoutRef.current
    );
  }, [initAudio, playBeepSound, playShutterSound, generateDuoStrip]);

  const setupDataConnection = useCallback(
    (conn: DataConnection) => {
      conn.on('open', () => {
        setIsConnected(true);
        setStatusMessage('Terhubung! Wajah dan suara pasangan aktif.');
      });

      conn.on('data', (data: any) => {
        if (data?.type === 'START_COUNTDOWN') {
          executePhotoSession();
        } else if (data?.type === 'THEME_CHANGE' && data?.theme) {
          setSelectedTheme(data.theme);
          selectedThemeRef.current = data.theme;
          if (capturedPhotosRef.current.length > 0) {
            generateDuoStrip(
              capturedPhotosRef.current,
              data.theme,
              selectedFilterRef.current,
              customNoteRef.current,
              selectedLayoutRef.current
            );
          }
        } else if (data?.type === 'FILTER_CHANGE' && data?.filter) {
          setSelectedFilter(data.filter);
          selectedFilterRef.current = data.filter;
          if (capturedPhotosRef.current.length > 0) {
            generateDuoStrip(
              capturedPhotosRef.current,
              selectedThemeRef.current,
              data.filter,
              customNoteRef.current,
              selectedLayoutRef.current
            );
          }
        } else if (
          data?.type === 'LAYOUT_CHANGE' &&
          (data?.layout === 'strip4' || data?.layout === 'strip3' || data?.layout === 'grid')
        ) {
          setSelectedLayout(data.layout);
          selectedLayoutRef.current = data.layout;
          if (capturedPhotosRef.current.length > 0) {
            generateDuoStrip(
              capturedPhotosRef.current,
              selectedThemeRef.current,
              selectedFilterRef.current,
              customNoteRef.current,
              data.layout
            );
          }
        } else if (data?.type === 'NOTE_CHANGE' && typeof data?.note === 'string') {
          setCustomNote(data.note);
          customNoteRef.current = data.note;
          if (capturedPhotosRef.current.length > 0) {
            generateDuoStrip(
              capturedPhotosRef.current,
              selectedThemeRef.current,
              selectedFilterRef.current,
              data.note,
              selectedLayoutRef.current
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
        setStatusMessage('Bagikan kodemu ke pasangan.');
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
          setStatusMessage('Pasangan tersambung! Bersiaplah.');
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
      setStatusMessage('Berhasil tersambung dengan pasangan!');
    });
  };

  const handleCopyCode = () => {
    if (!peerId) return;
    navigator.clipboard.writeText(peerId);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleTriggerSession = () => {
    initAudio();
    if (connRef.current) {
      connRef.current.send({ type: 'START_COUNTDOWN' });
    }
    executePhotoSession();
  };

  const handleThemeChange = (newTheme: FrameThemeKey) => {
    setSelectedTheme(newTheme);
    selectedThemeRef.current = newTheme;
    if (capturedPhotos.length > 0) {
      generateDuoStrip(capturedPhotos, newTheme, selectedFilter, customNote, selectedLayout);
    }
    if (connRef.current) {
      connRef.current.send({ type: 'THEME_CHANGE', theme: newTheme });
    }
  };

  const handleFilterChange = (newFilter: PhotoFilterKey) => {
    setSelectedFilter(newFilter);
    selectedFilterRef.current = newFilter;
    if (capturedPhotos.length > 0) {
      generateDuoStrip(capturedPhotos, selectedTheme, newFilter, customNote, selectedLayout);
    }
    if (connRef.current) {
      connRef.current.send({ type: 'FILTER_CHANGE', filter: newFilter });
    }
  };

  const handleLayoutChange = (newLayout: LayoutMode) => {
    setSelectedLayout(newLayout);
    selectedLayoutRef.current = newLayout;
    if (capturedPhotos.length > 0) {
      generateDuoStrip(capturedPhotos, selectedTheme, selectedFilter, customNote, newLayout);
    }
    if (connRef.current) {
      connRef.current.send({ type: 'LAYOUT_CHANGE', layout: newLayout });
    }
  };

  const handleNoteChange = (text: string) => {
    setCustomNote(text);
    customNoteRef.current = text;
    if (capturedPhotos.length > 0) {
      generateDuoStrip(capturedPhotos, selectedTheme, selectedFilter, text, selectedLayout);
    }
    if (connRef.current) {
      connRef.current.send({ type: 'NOTE_CHANGE', note: text });
    }
  };

  const handleDownload = async () => {
    if (!finalStripUrl) return;

    const fileName = `dekatan-duo-${selectedLayout}-${selectedTheme}-${Date.now()}.png`;

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
    } catch (error) {
      console.log('Web Share dibatalkan atau tidak didukung:', error);
    }

    const link = document.createElement('a');
    link.download = fileName;
    link.href = finalStripUrl;
    link.click();
  };

  const handleRetake = () => {
    setFinalStripUrl(null);
    setCapturedPhotos([]);
    setCurrentShot(0);
  };

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
          <span className="text-[11px] md:text-xs font-semibold tracking-wider text-[#DA6868] uppercase bg-rose-50 px-3 py-1 md:py-1.5 rounded-full border border-rose-100 flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5" />
            Mode Berdua (LDR)
          </span>
        </div>
      </div>

      {!isConnected && !finalStripUrl && (
        <div className="w-full max-w-md bg-white rounded-3xl p-5 md:p-6 shadow-sm border border-stone-200 mb-6">
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
              placeholder="Kode pasangan"
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
                Foto ke-{currentShot} dari 4
              </div>
            )}
          </div>

          <div className="w-full flex items-center justify-between my-3.5 px-2">
            <div className="flex gap-2">
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

            <button
              onClick={toggleMic}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium flex items-center gap-1.5 touch-manipulation active:scale-95 transition ${
                isMicMuted
                  ? 'bg-red-50 text-red-600 border border-red-200'
                  : 'bg-emerald-50 text-emerald-600 border border-emerald-200'
              }`}
            >
              {isMicMuted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
              {isMicMuted ? 'Mikrofon Mati' : 'Mikrofon Nyala'}
            </button>
          </div>

          <div className="w-full">
            <button
              onClick={handleTriggerSession}
              disabled={!isConnected || !cameraReady || isCapturing || isGeneratingStrip}
              className={`w-full py-4 rounded-2xl font-bold text-white shadow-lg flex items-center justify-center gap-3 touch-manipulation transition-all ${
                !isConnected || !cameraReady || isCapturing || isGeneratingStrip
                  ? 'bg-slate-400 cursor-not-allowed opacity-60'
                  : 'bg-[#DA6868] hover:bg-[#c85656] active:scale-[0.98]'
              }`}
            >
              <Camera className="w-5 h-5" />
              {isCapturing
                ? `Mengambil Foto Bersama (${currentShot}/4)...`
                : isGeneratingStrip
                ? 'Menyusun Foto...'
                : isConnected
                ? 'Mulai Foto Berdua (4 Jepretan)'
                : 'Tunggu Pasangan Tersambung'}
            </button>
            <p className="text-center text-xs text-slate-500 mt-2">
              Salah satu menekan tombol, hitungan mundur dan suara rana berbunyi di kedua layar.
            </p>
          </div>
        </div>
      )}

      {finalStripUrl && (
        <div className="w-full max-w-md flex flex-col items-center animate-fade-in">
          <div className="flex items-center gap-2 text-stone-600 mb-2.5 text-sm font-semibold">
            <Sparkles className="w-4 h-4 text-[#DA6868]" />
            Hasil Foto Berdua Sudah Jadi!
          </div>

          {/* PEMILIH TATA LETAK DUO: STRIP 1x4, STRIP 1x3, ATAU GRID 2x2 */}
          <div className="flex flex-wrap items-center justify-center gap-1.5 mb-2.5 bg-white p-1.5 rounded-2xl shadow-xs border border-stone-200">
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
            <span className="text-[10px] bg-rose-50 text-[#DA6868] px-2 py-0.5 rounded-full font-medium border border-rose-100 ml-1">
              Tersinkron
            </span>
          </div>

          {/* PEMILIH FILTER */}
          <div className="flex items-center gap-1.5 mb-2.5 bg-white px-3 py-1.5 rounded-2xl shadow-xs border border-stone-200">
            <span className="text-xs font-semibold text-stone-500 mr-1.5">Filter:</span>
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

          {/* PEMILIH WARNA BINGKAI */}
          <div className="flex items-center gap-3 mb-3 bg-white px-4 py-2 rounded-2xl shadow-xs border border-stone-200">
            <span className="text-xs font-semibold text-stone-500 mr-1">Warna:</span>
            {(Object.keys(FRAME_THEMES) as FrameThemeKey[]).map((key) => {
              const theme = FRAME_THEMES[key];
              const isSelected = selectedTheme === key;
              return (
                <button
                  key={key}
                  onClick={() => handleThemeChange(key)}
                  className={`w-7 h-7 rounded-full transition-all border-2 touch-manipulation flex items-center justify-center ${
                    isSelected ? 'scale-110 ring-2 ring-[#DA6868] ring-offset-2' : 'hover:scale-105 opacity-85'
                  }`}
                  style={{ backgroundColor: theme.bg, borderColor: theme.swatchBorder }}
                  title={theme.name}
                />
              );
            })}
          </div>

          {/* INPUT PESAN PRIBADI */}
          <div className="w-full bg-white p-3 rounded-2xl shadow-xs border border-stone-200 mb-4">
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
              placeholder="Contoh: Nama anda & Pasangan — Jarak Bukan Halangan"
              value={customNote}
              onChange={(e) => handleNoteChange(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-stone-200 focus:outline-none focus:border-[#DA6868] text-stone-700 placeholder:text-stone-400"
            />
            <div className="flex justify-between items-center mt-1">
              <span className="text-[10px] text-stone-400">Tercetak langsung di strip foto</span>
              <span className="text-[10px] text-stone-400">{customNote.length}/40</span>
            </div>
          </div>

          {/* PRATINJAU KANVAS HASIL FOTO */}
          <div
            className={`p-3 bg-white rounded-2xl shadow-2xl border border-stone-200 ${
              selectedLayout === 'grid'
                ? 'max-w-[320px]'
                : selectedLayout === 'strip3'
                ? 'max-w-[250px]'
                : 'max-w-[270px]'
            }`}
          >
            {/* eslint-disable-next-html-element/no-img-element */}
            <img src={finalStripUrl} alt="Hasil Photobooth Berdua" className="w-full h-auto rounded-lg shadow-inner" />
          </div>

          <div className="w-full flex flex-col gap-3 mt-6">
            <button
              onClick={handleDownload}
              className="w-full py-3.5 bg-[#DA6868] text-white font-bold rounded-xl shadow-md hover:bg-[#c85656] active:scale-95 touch-manipulation flex items-center justify-center gap-2 transition"
            >
              <Download className="w-5 h-5" />
              Simpan / Bagikan Foto ({selectedLayout === 'grid' ? 'Grid 2×2' : selectedLayout === 'strip3' ? 'Strip 1×3' : 'Strip 1×4'})
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