'use client';

import { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Award, Loader2, Sparkles, AlertCircle, CheckCircle, Volume2, VolumeX, Copy, Check, Ticket } from 'lucide-react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import ContactModal from '../components/ContactModal';
import HistoryModal from '../components/HistoryModal';
import CanvasBackground from '../components/CanvasBackground';
import Link from 'next/link';
import GachaTierSelector from '../components/GachaTierSelector';

// ─── Gacha Tier Page Themes ───
const tierPageThemes = {
  normal: {
    glowColor: '56, 189, 248', // sky-400
    indicatorBorderT: 'border-t-sky-400',
    indicatorDropShadow: 'drop-shadow-[0_2px_8px_rgba(56,189,248,0.5)]',
    btnBg: 'bg-sky-500 text-sky-950 hover:bg-sky-400 hover:shadow-[0_0_40px_rgba(56,189,248,0.4)]',
    btnSpinning: 'bg-sky-600 text-sky-100',
    sliceColorOdd: '#0369a1', // sky-700
    sliceColorEven: '#0284c7', // sky-600
    hubBorder: '#38bdf8', // sky-400
    hubDot: '#38bdf8',
  },
  premium: {
    glowColor: '245, 158, 11', // amber-500
    indicatorBorderT: 'border-t-amber-400',
    indicatorDropShadow: 'drop-shadow-[0_2px_8px_rgba(245,158,11,0.5)]',
    btnBg: 'bg-amber-500 text-amber-950 hover:bg-amber-400 hover:shadow-[0_0_40px_rgba(245,158,11,0.4)]',
    btnSpinning: 'bg-amber-600 text-amber-100',
    sliceColorOdd: '#b45309', // amber-700
    sliceColorEven: '#d97706', // amber-600
    hubBorder: '#fbbf24', // amber-400
    hubDot: '#fbbf24',
  },
  luxury: {
    glowColor: '244, 63, 94', // rose-500
    indicatorBorderT: 'border-t-rose-400',
    indicatorDropShadow: 'drop-shadow-[0_2px_8px_rgba(244,63,94,0.5)]',
    btnBg: 'bg-rose-500 text-rose-950 hover:bg-rose-400 hover:shadow-[0_0_40px_rgba(244,63,94,0.4)]',
    btnSpinning: 'bg-rose-600 text-rose-100',
    sliceColorOdd: '#be123c', // rose-700
    sliceColorEven: '#e11d48', // rose-600
    hubBorder: '#fda4af', // rose-300
    hubDot: '#f43f5e', // rose-500
  },
};

const getPageTheme = (slug) => {
  return tierPageThemes[slug] || tierPageThemes.normal;
};

// ─── Confetti / Particle System ───
function useConfetti() {
  const canvasRef = useRef(null);
  const particlesRef = useRef([]);
  const animFrameRef = useRef(null);

  const launch = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const colors = ['#38bdf8', '#818cf8', '#f472b6', '#facc15', '#34d399', '#fb923c', '#c084fc'];
    const particles = [];

    for (let i = 0; i < 120; i++) {
      particles.push({
        x: canvas.width / 2 + (Math.random() - 0.5) * 200,
        y: canvas.height / 2,
        vx: (Math.random() - 0.5) * 16,
        vy: (Math.random() - 1) * 14 - 4,
        size: Math.random() * 8 + 3,
        color: colors[Math.floor(Math.random() * colors.length)],
        rotation: Math.random() * 360,
        rotationSpeed: (Math.random() - 0.5) * 12,
        gravity: 0.2 + Math.random() * 0.15,
        opacity: 1,
        shape: Math.random() > 0.5 ? 'rect' : 'circle',
      });
    }
    particlesRef.current = particles;

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      let alive = false;
      particlesRef.current.forEach(p => {
        p.vy += p.gravity;
        p.x += p.vx;
        p.y += p.vy;
        p.rotation += p.rotationSpeed;
        p.opacity -= 0.008;
        if (p.opacity <= 0) return;
        alive = true;

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rotation * Math.PI) / 180);
        ctx.globalAlpha = p.opacity;
        ctx.fillStyle = p.color;
        if (p.shape === 'rect') {
          ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
        } else {
          ctx.beginPath();
          ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      });
      if (alive) {
        animFrameRef.current = requestAnimationFrame(animate);
      }
    };
    animate();
  };

  const cleanup = () => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
  };

  return { canvasRef, launch, cleanup };
}

// ─── Floating Orbs Background Component ───
function FloatingOrbs() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
      {[...Array(6)].map((_, i) => (
        <div
          key={i}
          className="absolute rounded-full blur-3xl opacity-[0.04]"
          style={{
            width: `${120 + i * 40}px`,
            height: `${120 + i * 40}px`,
            background: i % 2 === 0
              ? 'radial-gradient(circle, #38bdf8, transparent)'
              : 'radial-gradient(circle, #a78bfa, transparent)',
            left: `${10 + i * 15}%`,
            top: `${20 + (i % 3) * 25}%`,
            animation: `floatOrb${i % 3} ${8 + i * 2}s ease-in-out infinite`,
          }}
        />
      ))}
      <style jsx>{`
        @keyframes floatOrb0 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(30px, -40px) scale(1.15); }
        }
        @keyframes floatOrb1 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(-25px, 35px) scale(1.1); }
        }
        @keyframes floatOrb2 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(20px, 25px) scale(1.2); }
        }
      `}</style>
    </div>
  );
}

export default function GachaPage() {
  const { data: session, update: updateSession } = useSession();
  const queryClient = useQueryClient();
  const canvasRef = useRef(null);

  const [contactOpen, setContactOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Wheel animation states
  const [spinning, setSpinning] = useState(false);
  const [spinResult, setSpinResult] = useState(null);
  const [copied, setCopied] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [selectedTierId, setSelectedTierId] = useState(null);

  // Page entrance animation
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 50);
    return () => clearTimeout(timer);
  }, []);

  // Confetti system
  const { canvasRef: confettiCanvasRef, launch: launchConfetti, cleanup: cleanupConfetti } = useConfetti();
  useEffect(() => {
    return () => cleanupConfetti();
  }, []);

  // Wheel glow pulse during spinning
  const [glowIntensity, setGlowIntensity] = useState(0);
  useEffect(() => {
    if (!spinning) { setGlowIntensity(0); return; }
    let frame;
    let start;
    const pulse = (ts) => {
      if (!start) start = ts;
      const t = (ts - start) / 200;
      setGlowIntensity(0.3 + Math.sin(t) * 0.2);
      frame = requestAnimationFrame(pulse);
    };
    frame = requestAnimationFrame(pulse);
    return () => cancelAnimationFrame(frame);
  }, [spinning]);

  // Audio Synth Tick function (mechanical wheel ticks)
  const playTickSound = () => {
    if (!soundEnabled) return;
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(600, audioCtx.currentTime);
      gainNode.gain.setValueAtTime(0.04, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.04);
      
      osc.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      
      osc.start();
      osc.stop(audioCtx.currentTime + 0.04);
    } catch (e) {
      console.warn('AudioContext not allowed or not supported:', e);
    }
  };

  // Win celebration sound
  const playWinSound = () => {
    if (!soundEnabled) return;
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const notes = [523, 659, 784, 1047];
      notes.forEach((freq, i) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, audioCtx.currentTime + i * 0.12);
        gain.gain.setValueAtTime(0.08, audioCtx.currentTime + i * 0.12);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + i * 0.12 + 0.3);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(audioCtx.currentTime + i * 0.12);
        osc.stop(audioCtx.currentTime + i * 0.12 + 0.3);
      });
    } catch (e) { /* ignore */ }
  };

  // Fetch Gacha wheel configuration (prizes) & recent winners
  const { data: gachaData, isLoading, isError, refetch } = useQuery({
    queryKey: ['gacha-data'],
    queryFn: async () => {
      const res = await fetch('/api/gacha/spin');
      if (!res.ok) throw new Error('ไม่สามารถโหลดข้อมูลสุ่มรางวัลได้');
      return res.json();
    }
  });

  const allTiers = gachaData?.tiers || [];
  const pointTier = allTiers.find(t => t.slug === 'point');
  const tiers = allTiers.filter(tier => tier.slug !== 'point');
  const winners = (gachaData?.logs || []).filter(log => log.tierId !== pointTier?.id);
  const selectedTier = tiers.find(tier => tier.id === selectedTierId)
    || tiers.find(tier => tier.isReady && tier.isActive)
    || tiers[0]
    || null;
  const prizes = selectedTier?.items || [];


  const handleTierSelect = tier => {
    if (spinning) return;
    setSelectedTierId(tier.id);
    setSpinResult(null);
    setErrorMsg('');
  };

  // Canvas drawing effect whenever prizes list loads
  useEffect(() => {
    drawWheel(0);
  }, [prizes]);

  // Mechanical Wheel Drawing on HTML5 Canvas
  const drawWheel = (angleOffset) => {
    const canvas = canvasRef.current;
    if (!canvas || prizes.length === 0) return;
    const ctx = canvas.getContext('2d');
    const size = canvas.width;
    const center = size / 2;
    const bezelWidth = 20;
    const radius = center - bezelWidth - 5; // leave room for bezel and top indicator

    ctx.clearRect(0, 0, size, size);

    const arcAngle = (2 * Math.PI) / prizes.length;
    const pageTheme = getPageTheme(selectedTier?.slug);

    // Slices Colors Gradient (Neon cyberpunk style radial gradients)
    const getSliceStyle = (type, index) => {
      let startColor, endColor;
      if (type === 'empty') {
        startColor = '#1e293b';
        endColor = '#0f172a';
      } else if (type === 'coupon') {
        startColor = '#10b981';
        endColor = '#064e3b';
      } else {
        if (selectedTier?.slug === 'normal') {
          startColor = '#7dd3fc'; // sky-300
          endColor = index % 2 === 0 ? '#0369a1' : '#0284c7';
        } else if (selectedTier?.slug === 'premium') {
          startColor = '#fde047'; // yellow-300
          endColor = index % 2 === 0 ? '#b45309' : '#d97706';
        } else if (selectedTier?.slug === 'luxury') {
          startColor = '#fda4af'; // rose-300
          endColor = index % 2 === 0 ? '#be123c' : '#e11d48';
        } else {
          startColor = '#f3e8ff';
          endColor = index % 2 === 0 ? '#6b21a8' : '#7e22ce';
        }
      }

      // Create a radial gradient from center of wheel out to radius
      const sliceGrad = ctx.createRadialGradient(center, center, radius * 0.1, center, center, radius);
      sliceGrad.addColorStop(0, startColor);
      sliceGrad.addColorStop(1, endColor);
      return sliceGrad;
    };

    prizes.forEach((prize, i) => {
      const currentAngle = angleOffset + i * arcAngle;

      ctx.beginPath();
      ctx.arc(center, center, radius, currentAngle, currentAngle + arcAngle);
      ctx.lineTo(center, center);
      ctx.fillStyle = getSliceStyle(prize.type, i);
      ctx.fill();

      // Glowing divider lines
      ctx.beginPath();
      ctx.moveTo(center, center);
      ctx.lineTo(center + radius * Math.cos(currentAngle), center + radius * Math.sin(currentAngle));
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Draw prize text label with premium icon indicator
      ctx.save();
      ctx.translate(center, center);
      ctx.rotate(currentAngle + arcAngle / 2);
      ctx.textAlign = 'right';
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 9px Prompt, sans-serif';

      let icon = '';
      if (prize.type === 'empty') icon = '✦ ';
      else if (prize.type === 'coupon') icon = '🎫 ';
      else icon = '🎁 ';

      let label = icon + prize.name;
      if (label.length > 18) label = label.substring(0, 16) + '..';

      ctx.fillText(label, radius - 20, 3);
      ctx.restore();
    });

    // 1. Draw Outer Bezel
    const bezelRadius = radius + bezelWidth / 2;
    ctx.beginPath();
    ctx.arc(center, center, radius + bezelWidth, 0, 2 * Math.PI);
    ctx.arc(center, center, radius, 0, 2 * Math.PI, true); // hole cutout
    
    // Create metallic linear gradient running diagonally
    const bezelGrad = ctx.createLinearGradient(0, 0, size, size);
    if (selectedTier?.slug === 'normal') {
      bezelGrad.addColorStop(0, '#334155');
      bezelGrad.addColorStop(0.25, '#94a3b8');
      bezelGrad.addColorStop(0.5, '#475569');
      bezelGrad.addColorStop(0.75, '#cbd5e1');
      bezelGrad.addColorStop(1, '#1e293b');
    } else if (selectedTier?.slug === 'premium') {
      bezelGrad.addColorStop(0, '#78350f');
      bezelGrad.addColorStop(0.25, '#fbbf24');
      bezelGrad.addColorStop(0.5, '#b45309');
      bezelGrad.addColorStop(0.75, '#fef08a');
      bezelGrad.addColorStop(1, '#451a03');
    } else if (selectedTier?.slug === 'luxury') {
      bezelGrad.addColorStop(0, '#881337');
      bezelGrad.addColorStop(0.25, '#fb7185');
      bezelGrad.addColorStop(0.5, '#be123c');
      bezelGrad.addColorStop(0.75, '#ffe4e6');
      bezelGrad.addColorStop(1, '#4c0519');
    } else {
      bezelGrad.addColorStop(0, '#581c87');
      bezelGrad.addColorStop(0.25, '#c084fc');
      bezelGrad.addColorStop(0.5, '#7e22ce');
      bezelGrad.addColorStop(0.75, '#e9d5ff');
      bezelGrad.addColorStop(1, '#3b0764');
    }
    ctx.fillStyle = bezelGrad;
    ctx.fill();

    // Inner & outer borders on bezel
    ctx.beginPath();
    ctx.arc(center, center, radius + bezelWidth, 0, 2 * Math.PI);
    ctx.strokeStyle = selectedTier?.slug === 'premium' ? 'rgba(251, 191, 36, 0.4)' : selectedTier?.slug === 'luxury' ? 'rgba(251, 113, 133, 0.4)' : 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(center, center, radius, 0, 2 * Math.PI);
    ctx.strokeStyle = selectedTier?.slug === 'premium' ? 'rgba(251, 191, 36, 0.4)' : selectedTier?.slug === 'luxury' ? 'rgba(251, 113, 133, 0.4)' : 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // 2. Draw flashing LEDs around the Bezel
    const ledCount = 16;
    for (let i = 0; i < ledCount; i++) {
      const ledAngle = i * (2 * Math.PI / ledCount);
      const ledX = center + bezelRadius * Math.cos(ledAngle);
      const ledY = center + bezelRadius * Math.sin(ledAngle);

      // LED chaser pattern
      const ledIndexOffset = Math.floor((angleOffset * ledCount) / (2 * Math.PI));
      const isActive = (i + ledIndexOffset) % 4 === 0;

      ctx.beginPath();
      ctx.arc(ledX, ledY, 3.5, 0, 2 * Math.PI);
      
      let ledColor = 'rgba(255, 255, 255, 0.2)';
      if (isActive) {
        if (selectedTier?.slug === 'normal') ledColor = '#38bdf8';
        else if (selectedTier?.slug === 'premium') ledColor = '#fbbf24';
        else if (selectedTier?.slug === 'luxury') ledColor = '#f43f5e';
        else ledColor = '#c084fc';
        
        ctx.shadowColor = ledColor;
        ctx.shadowBlur = 8;
      } else {
        ctx.shadowBlur = 0;
      }
      ctx.fillStyle = ledColor;
      ctx.fill();
      ctx.shadowBlur = 0; // reset
    }

    // Draw central hub
    ctx.beginPath();
    ctx.arc(center, center, 24, 0, 2 * Math.PI);
    ctx.fillStyle = '#0f172a';
    ctx.strokeStyle = pageTheme.hubBorder;
    ctx.lineWidth = 3;
    ctx.fill();
    ctx.stroke();

    // Draw central inner dot
    ctx.beginPath();
    ctx.arc(center, center, 8, 0, 2 * Math.PI);
    ctx.fillStyle = pageTheme.hubDot;
    ctx.fill();
  };

  // Mutation to execute Gacha Spin on Server
  const spinMutation = useMutation({
    mutationFn: async () => {
      setErrorMsg('');
      const res = await fetch('/api/gacha/spin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tierId: selectedTier?.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'หมุนวงล้อล้มเหลว');
      return data;
    },
    onSuccess: (data) => {
      // Start client animation based on won item ID
      animateSpin(data);
    },
    onError: (err) => {
      setSpinning(false);
      setErrorMsg(err.message);
    }
  });

  const handleSpinClick = () => {
    if (spinning || prizes.length === 0 || !selectedTier?.isReady) return;
    if (!session) {
      setErrorMsg('กรุณาเข้าสู่ระบบก่อนหมุนวงล้อ');
      return;
    }
    if (Number(session.user.balance) < selectedTier.price) {
      setErrorMsg(`Insufficient balance (requires ${selectedTier.price.toLocaleString()} THB)`);
      return;
    }

    setSpinning(true);
    spinMutation.mutate();
  };

  // Spring back-out easing for realistic rebound bounce
  const easeOutBack = (x) => {
    const c1 = 0.7; // bounce overshoot intensity
    const c2 = c1 + 1;
    return 1 + c2 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
  };

  // Spin physics engine simulation
  const animateSpin = (result) => {
    const targetIdx = prizes.findIndex(item => item._id === result.itemId);
    if (targetIdx === -1) {
      setSpinning(false);
      return;
    }

    const arcAngle = (2 * Math.PI) / prizes.length;
    
    // Calculate winning angle alignment
    // Indicator is pointing at the top (-Math.PI/2 or 270 deg)
    const baseRotations = 6 + Math.floor(Math.random() * 2); // 6 to 7 full spins
    const targetSliceCenter = targetIdx * arcAngle + arcAngle / 2;
    const targetAngle = 2 * Math.PI * baseRotations - targetSliceCenter - Math.PI / 2;

    let startTime = null;
    const duration = 6000; // 6 seconds spin duration
    let lastTickSlice = 0;

    const loop = (timestamp) => {
      if (!startTime) startTime = timestamp;
      const elapsed = timestamp - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Spring-Elastic Easing
      const easeProgress = easeOutBack(progress);
      const currentAngle = easeProgress * targetAngle;

      // Slice tick tracker - ticks exactly when crossing slice boundary lines
      const currentSlice = Math.floor(currentAngle / arcAngle);
      if (currentSlice !== lastTickSlice) {
        playTickSound();
        lastTickSlice = currentSlice;
      }

      drawWheel(currentAngle);

      if (progress < 1) {
        requestAnimationFrame(loop);
      } else {
        // Animation finished
        setSpinning(false);
        setSpinResult(result);
        
        // Play win sound and confetti if won a prize
        if (result.type !== 'empty') {
          playWinSound();
          setTimeout(() => launchConfetti(), 200);
        }

        // Refresh Wallet balance on Navbar & recent winners lists
        updateSession({ refresh: true });
        refetch();
        queryClient.invalidateQueries({ queryKey: ['transactions'] });
      }
    };

    requestAnimationFrame(loop);
  };

  const handleCopy = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative min-h-screen flex flex-col bg-[#02060d]">
      <CanvasBackground />
      <FloatingOrbs />
      <Navbar onOpenContact={() => setContactOpen(true)} onOpenHistory={() => setHistoryOpen(true)} />

      {/* Confetti overlay canvas */}
      <canvas
        ref={confettiCanvasRef}
        className="fixed inset-0 z-[60] pointer-events-none"
        style={{ width: '100vw', height: '100vh' }}
      />

      {/* Main Gacha Layout */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10 relative z-10 grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Col & Mid Col: Lucky Wheel board */}
        <div className={`lg:col-span-2 flex flex-col items-center justify-center space-y-6 transition-all duration-700 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          
          {/* Header Title */}
          {(() => {
            const pageTheme = getPageTheme(selectedTier?.slug);
            return (
              <>
                <div className="text-center space-y-2">
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-black uppercase tracking-widest animate-pulse"
                    style={{
                      borderColor: `rgba(${pageTheme.glowColor}, 0.25)`,
                      background: `rgba(${pageTheme.glowColor}, 0.08)`,
                      borderWidth: '1px',
                      color: `rgb(${pageTheme.glowColor})`
                    }}
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    Gacha {selectedTier?.name || 'Lucky Wheel'}
                  </span>
                  <h1 className="text-2xl sm:text-4xl font-black text-white glow-text"
                    style={{
                      textShadow: `0 0 15px rgba(${pageTheme.glowColor}, 0.4)`
                    }}
                  >
                    วงล้อ{selectedTier?.name || 'นำโชค'}
                  </h1>
                  <p className="text-xs text-zinc-400 max-w-lg mx-auto leading-relaxed">
                    {selectedTier?.slug === 'normal' && 'เสี่ยงโชคลุ้นรับ คีย์เน็ตฟลิกซ์ บัตรสตรีม หรือคูปองส่วนลด ในราคาสบายกระเป๋าเพียง 30 บาทต่อสปิน!'}
                    {selectedTier?.slug === 'premium' && 'ยกระดับความคุ้มค่า! ลุ้นรางวัลที่มีโอกาสได้ของดีสูงขึ้น โค้ดเกมพรีเมียมเพียบ ในราคา 100 บาท!'}
                    {selectedTier?.slug === 'luxury' && 'ขั้นสุดแห่งความพรีเมียม! รางวัลใหญ่ระดับ Luxury โอกาสออกเกลือน้อยที่สุด คุ้มค่าที่สุด!'}
                    {!['normal', 'premium', 'luxury'].includes(selectedTier?.slug) && `ลุ้นรับของรางวัลสุดพิเศษจากระดับ ${selectedTier?.name || 'นำโชค'}`}
                  </p>
                </div>

                {tiers.length > 0 && (
                  <div className="w-full max-w-3xl">
                    <GachaTierSelector tiers={tiers} selectedTierId={selectedTier?.id} onSelect={handleTierSelect} />
                  </div>
                )}

                {errorMsg && (
                  <div className="max-w-md w-full bg-red-500/10 border border-red-500/20 px-4 py-2.5 rounded-xl text-xs text-red-400 flex items-center gap-1.5 justify-center animate-[shake_0.5s_ease-in-out]">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                {/* Wheel Visual Canvas Container */}
                <div
                  className={`relative w-[320px] h-[320px] sm:w-[400px] sm:h-[400px] rounded-full flex items-center justify-center p-4 transition-all duration-300 ${
                    spinning ? 'scale-[1.02]' : 'hover:scale-[1.01]'
                  }`}
                  style={{
                    background: 'rgba(9,14,25,0.2)',
                    backdropFilter: 'blur(12px)',
                    border: `1px solid rgba(${pageTheme.glowColor}, 0.15)`,
                    boxShadow: spinning
                      ? `0 0 ${40 + glowIntensity * 60}px rgba(${pageTheme.glowColor},${glowIntensity}), 0 0 ${80 + glowIntensity * 100}px rgba(${pageTheme.glowColor},${glowIntensity * 0.3}), inset 0 0 30px rgba(${pageTheme.glowColor},${glowIntensity * 0.1})`
                      : `0 0 30px rgba(${pageTheme.glowColor},0.05), inset 0 0 20px rgba(${pageTheme.glowColor},0.02)`,
                  }}
                >
                  {/* Outer Ring Decoration */}
                  <div
                    className="absolute inset-0 rounded-full pointer-events-none"
                    style={{
                      background: `conic-gradient(from 0deg, transparent, rgba(${pageTheme.glowColor},${spinning ? 0.1 : 0.03}), transparent, rgba(167,139,250,${spinning ? 0.08 : 0.02}), transparent)`,
                      animation: spinning ? 'spin 3s linear infinite' : 'spin 20s linear infinite',
                    }}
                  />

                  {/* Spinning Canvas */}
                  <canvas 
                    ref={canvasRef} 
                    width={400} 
                    height={400} 
                    className="w-full h-full rounded-full relative z-10"
                  />

                  {/* Top Indicator Triangle Arrow */}
                  <div className={`absolute -top-1.5 left-1/2 -translate-x-1/2 z-20 transition-transform ${spinning ? 'animate-[indicatorBounce_0.3s_ease-in-out_infinite]' : ''}`}>
                    <div className={`w-0 h-0 border-l-[14px] border-l-transparent border-r-[14px] border-r-transparent border-t-[22px] ${pageTheme.indicatorBorderT} filter ${pageTheme.indicatorDropShadow}`} />
                  </div>
                </div>

                {/* Action Button & Sound toggle */}
                <div className="flex flex-col sm:flex-row items-center gap-4 w-full justify-center">
                  
                  {/* Spin CTA Button */}
                  <button
                    onClick={handleSpinClick}
                    disabled={spinning || isLoading || prizes.length === 0 || !selectedTier?.isReady}
                    className={`w-full sm:w-[220px] flex items-center justify-center gap-1.5 font-black py-3.5 px-6 rounded-xl disabled:opacity-50 disabled:pointer-events-none transition-all text-xs tracking-wider cursor-pointer ${
                      spinning
                        ? `${pageTheme.btnSpinning} animate-pulse`
                        : `${pageTheme.btnBg} glow-btn`
                    }`}
                  >
                    {spinning ? (
                      <>
                        <Loader2 className="w-4.5 h-4.5 animate-spin" />
                        <span>กำลังหมุนลุ้นรางวัล...</span>
                      </>
                    ) : (
                      <>
                        <Award className="w-4.5 h-4.5" />
                        <span>หมุนวงล้อ ({selectedTier?.price?.toLocaleString() || 0} THB)</span>
                      </>
                    )}
                  </button>

                  {/* Audio Toggle button */}
                  <button
                    onClick={() => setSoundEnabled(!soundEnabled)}
                    className="p-3 border border-white/5 bg-zinc-950/40 rounded-xl text-zinc-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
                    title={soundEnabled ? 'ปิดเสียง' : 'เปิดเสียง'}
                  >
                    {soundEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
                  </button>
                </div>
              </>
            );
          })()}

        </div>

        {/* Right Col: Recent Winners Dashboard */}
        <div className={`glass p-6 border border-white/5 rounded-2xl flex flex-col h-[500px] transition-all duration-700 delay-200 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          
          <div className="pb-3 border-b border-white/5 mb-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400 animate-[sparkle_2s_ease-in-out_infinite]" />
              <span>ผู้โชคดีรางวัลใหญ่ล่าสุด (Recent Winners)</span>
            </h3>
            <p className="text-[10px] text-zinc-500">ตารางความเคลื่อนไหวอัปเดตแบบเรียลไทม์</p>
          </div>

          {isLoading ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-2 text-xs text-zinc-500">
              <Loader2 className="w-6 h-6 animate-spin text-sky-400" />
              <span>กำลังดึงตารางผู้โชคดี...</span>
            </div>
          ) : winners.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-xs text-zinc-500 text-center">
              ยังไม่มีรายงานผู้ชนะรางวัลใหญ่ในขณะนี้
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              {winners.map((win, idx) => {
                const hiddenUsername = win.username.length > 4 
                  ? win.username.substring(0, 3) + '***' + win.username.substring(win.username.length - 2)
                  : win.username[0] + '***';

                return (
                  <div 
                    key={win._id} 
                    className="flex items-center justify-between p-3 rounded-xl border border-white/5 bg-zinc-950/20 hover:bg-white/5 transition-all text-xs hover:border-sky-500/10 group"
                    style={{
                      animation: `fadeSlideIn 0.4s ease-out ${idx * 0.05}s both`,
                    }}
                  >
                    <div className="space-y-0.5">
                      <span className="font-bold text-white block group-hover:text-sky-400 transition-colors">{hiddenUsername}</span>
                      <span className="text-[10px] text-zinc-400 font-semibold">{win.prizeName}</span>
                    </div>

                    <span className="text-[9px] text-zinc-500 shrink-0">
                      {new Date(win.createdAt).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.
                    </span>
                  </div>
                );
              })}
            </div>
          )}

        </div>

      </main>

      {/* MODAL: GACHA AWARD SPIN RESULT POPUP */}
      {spinResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-[fadeIn_0.3s_ease-out]">
          <div className="absolute inset-0" onClick={() => setSpinResult(null)} />
          
          <div className="relative w-full max-w-md bg-[#060c13]/90 border border-sky-500/25 p-7 rounded-3xl shadow-2xl backdrop-blur-xl z-10 text-center overflow-hidden animate-[popIn_0.4s_cubic-bezier(0.175,0.885,0.32,1.275)]">
            
            {/* Premium Conic Ray Burst */}
            {spinResult.type !== 'empty' && (
              <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-20 select-none z-0">
                <div 
                  className="absolute top-1/2 left-1/2 w-[700px] h-[700px] rounded-full"
                  style={{
                    background: 'conic-gradient(from 0deg, transparent 0deg 15deg, rgba(56,189,248,0.2) 15deg 30deg, transparent 30deg 45deg, rgba(245,158,11,0.2) 45deg 60deg, transparent 60deg 75deg, rgba(244,63,94,0.2) 75deg 90deg, transparent 90deg 105deg, rgba(56,189,248,0.2) 105deg 120deg, transparent 120deg 135deg, rgba(245,158,11,0.2) 135deg 150deg, transparent 150deg 165deg, rgba(244,63,94,0.2) 165deg 180deg, transparent 180deg 195deg, rgba(56,189,248,0.2) 195deg 210deg, transparent 210deg 225deg, rgba(245,158,11,0.2) 225deg 240deg, transparent 240deg 255deg, rgba(244,63,94,0.2) 255deg 270deg, transparent 270deg 285deg, rgba(56,189,248,0.2) 285deg 300deg, transparent 300deg 315deg, rgba(245,158,11,0.2) 315deg 330deg, transparent 330deg 345deg, rgba(244,63,94,0.2) 345deg 360deg)',
                    animation: 'rotateRay 20s linear infinite',
                  }}
                />
              </div>
            )}

            {/* Glow behind popup */}
            <div className={`absolute -top-12 -right-12 w-48 h-48 rounded-full blur-3xl ${spinResult.type === 'empty' ? 'bg-zinc-500/5' : 'bg-sky-500/15 animate-pulse'}`} />
            <div className={`absolute -bottom-12 -left-12 w-48 h-48 rounded-full blur-3xl ${spinResult.type === 'empty' ? 'bg-zinc-500/5' : 'bg-purple-500/15 animate-pulse'}`} />

            {spinResult.type === 'empty' ? (
              /* EMPTY RESULT */
              <div className="space-y-6 py-4 relative z-10">
                <div className="inline-flex bg-zinc-900 border border-zinc-800 p-5 rounded-full text-zinc-400 mx-auto animate-[wobble_0.8s_ease-in-out]">
                  <AlertCircle className="w-14 h-14" />
                </div>
                
                <div className="space-y-2">
                  <h2 className="text-xl font-bold text-zinc-200">เกลือจ้า! โอกาสหน้าลองใหม่</h2>
                  <p className="text-xs text-zinc-400 px-6 leading-relaxed">
                    น่าเสียดายที่สปินรอบนี้ไม่ได้รับของรางวัล ยอดเงินของคุณถูกหัก {spinResult.chargedPrice} บาท วงล้อนำโชคยินดีต้อนรับคุณอีกครั้ง!
                  </p>
                </div>

                <button
                  onClick={() => setSpinResult(null)}
                  className="w-full bg-zinc-800 text-zinc-300 hover:text-white py-3.5 rounded-xl font-bold text-xs cursor-pointer transition-colors hover:bg-zinc-700 active:scale-[0.98] transition-all"
                >
                  ปิดหน้าต่าง
                </button>
              </div>
            ) : (
              /* CODE OR COUPON AWARD RESULT */
              <div className="space-y-6 py-4 relative z-10">
                <div className="relative inline-flex mx-auto">
                  {/* Glowing decorative rings */}
                  <div className="absolute inset-0 rounded-full bg-sky-500/20 blur-md animate-ping" />
                  <div className="relative inline-flex bg-gradient-to-tr from-sky-400/20 to-indigo-500/20 border border-sky-400/30 p-5 rounded-full text-sky-400 animate-[bounceIn_0.6s_cubic-bezier(0.175,0.885,0.32,1.275)]">
                    <CheckCircle className="w-14 h-14" />
                  </div>
                </div>
                
                <div className="space-y-2 animate-[fadeSlideUp_0.5s_ease-out_0.2s_both]">
                  <span className="text-[10px] text-sky-400 font-extrabold uppercase tracking-widest flex items-center justify-center gap-1">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    ยินดีด้วยคุณได้รับรางวัล!
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  </span>
                  <h2 className="text-2xl font-black text-white glow-text leading-tight" style={{ textShadow: '0 0 20px rgba(56,189,248,0.5)' }}>
                    {spinResult.prizeName}
                  </h2>
                </div>

                {/* Received code box */}
                <div className="bg-zinc-950/70 border border-white/10 p-5 rounded-2xl text-left space-y-2.5 animate-[fadeSlideUp_0.5s_ease-out_0.35s_both] shadow-inner">
                  <span className="text-[10px] uppercase font-bold text-sky-400 tracking-wider flex items-center gap-1.5">
                    <Ticket className="w-4 h-4 text-sky-400" />
                    ข้อมูลของรางวัลที่ได้รับ
                  </span>

                  <div className="flex items-center justify-between gap-3 bg-white/5 border border-white/5 px-4 py-3 rounded-xl text-xs font-mono text-zinc-100 break-all select-all hover:border-sky-500/30 transition-colors shadow-inner">
                    <span className="tracking-wide select-all">{spinResult.wonValue}</span>
                    <button
                      onClick={() => handleCopy(spinResult.wonValue)}
                      className="shrink-0 text-sky-400 hover:text-sky-300 p-2 hover:bg-white/5 rounded-lg transition-colors cursor-pointer active:scale-90"
                    >
                      {copied ? (
                        <Check className="w-4.5 h-4.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-4.5 h-4.5" />
                      )}
                    </button>
                  </div>
                </div>

                <p className="text-[10px] text-zinc-400 leading-normal px-4 animate-[fadeSlideUp_0.5s_ease-out_0.5s_both]">
                  * หากเป็นคูปองสามารถคัดลอกไประบุช่องลดราคาตอนซื้อสินค้าได้ทันที รายการประวัติสุ่มถูกบันทึกสำเร็จเรียบร้อย
                </p>

                <button
                  onClick={() => setSpinResult(null)}
                  className="w-full bg-sky-500 text-sky-950 hover:bg-sky-400 py-3.5 rounded-xl font-bold text-xs cursor-pointer transition-all glow-btn hover:shadow-[0_0_35px_rgba(56,189,248,0.5)] active:scale-[0.97] animate-[fadeSlideUp_0.5s_ease-out_0.6s_both]"
                >
                  รับรางวัล
                </button>
              </div>
            )}

          </div>
        </div>
      )}

      {/* Auxiliary Modals */}
      <ContactModal isOpen={contactOpen} onClose={() => setContactOpen(false)} />
      <HistoryModal isOpen={historyOpen} onClose={() => setHistoryOpen(false)} />

      {/* Footer */}
      <Footer onOpenContact={() => setContactOpen(true)} />

      {/* Global Gacha Animations */}
      <style jsx global>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes popIn {
          0% { opacity: 0; transform: scale(0.8) translateY(20px); }
          100% { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes bounceIn {
          0% { opacity: 0; transform: scale(0.3); }
          50% { opacity: 1; transform: scale(1.1); }
          70% { transform: scale(0.95); }
          100% { transform: scale(1); }
        }
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateX(-10px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes wobble {
          0%, 100% { transform: rotate(0deg); }
          15% { transform: rotate(-12deg); }
          30% { transform: rotate(10deg); }
          45% { transform: rotate(-8deg); }
          60% { transform: rotate(5deg); }
          75% { transform: rotate(-2deg); }
        }
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          10%, 50%, 90% { transform: translateX(-4px); }
          30%, 70% { transform: translateX(4px); }
        }
        @keyframes indicatorBounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(3px); }
        }
        @keyframes sparkle {
          0%, 100% { opacity: 1; transform: scale(1) rotate(0deg); }
          50% { opacity: 0.6; transform: scale(0.85) rotate(15deg); }
        }
        @keyframes rotateRay {
          from { transform: translate(-50%, -50%) rotate(0deg); }
          to { transform: translate(-50%, -50%) rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
