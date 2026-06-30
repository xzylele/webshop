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

export default function GachaPage() {
  const { data: session, update: updateSession } = useSession();
  const queryClient = useQueryClient();
  const canvasRef = useRef(null);

  const [contactOpen, setContactOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Wheel animation states
  const [spinning, setSpinning] = useState(false);
  const [spinResult, setSpinResult] = useState(null); // stores result modal data
  const [copied, setCopied] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Audio Synth Tick function (mechanical wheel ticks)
  const playTickSound = () => {
    if (!soundEnabled) return;
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(600, audioCtx.currentTime); // 600 Hz
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

  // Fetch Gacha wheel configuration (prizes) & recent winners
  const { data: gachaData, isLoading, isError, refetch } = useQuery({
    queryKey: ['gacha-data'],
    queryFn: async () => {
      const res = await fetch('/api/gacha/spin');
      if (!res.ok) throw new Error('ไม่สามารถโหลดข้อมูลสุ่มรางวัลได้');
      return res.json();
    }
  });

  const prizes = gachaData?.items || [];
  const winners = gachaData?.logs || [];

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
    const radius = center - 15;

    ctx.clearRect(0, 0, size, size);

    const arcAngle = (2 * Math.PI) / prizes.length;

    // Slices Colors Palette (Neon cyberpunk dark palette)
    const getSliceColor = (type, index) => {
      if (type === 'empty') return index % 2 === 0 ? '#0b111e' : '#05080f'; // Dark steel/black
      if (type === 'coupon') return index % 2 === 0 ? '#064e3b' : '#047857'; // Forest emerald
      return index % 2 === 0 ? '#0369a1' : '#0284c7'; // Electric neon blue
    };

    prizes.forEach((prize, i) => {
      const currentAngle = angleOffset + i * arcAngle;

      ctx.beginPath();
      ctx.arc(center, center, radius, currentAngle, currentAngle + arcAngle);
      ctx.lineTo(center, center);
      ctx.fillStyle = getSliceColor(prize.type, i);
      ctx.fill();

      // Outer border stroke
      ctx.strokeStyle = 'rgba(255,255,255,0.06)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Draw prize text label
      ctx.save();
      ctx.translate(center, center);
      ctx.rotate(currentAngle + arcAngle / 2);
      ctx.textAlign = 'right';
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 9px Prompt, sans-serif';

      // Trim text if too long to fit nicely in the slice
      let label = prize.name;
      if (label.length > 18) label = label.substring(0, 16) + '..';

      ctx.fillText(label, radius - 20, 3);
      ctx.restore();
    });

    // Draw central hub
    ctx.beginPath();
    ctx.arc(center, center, 24, 0, 2 * Math.PI);
    ctx.fillStyle = '#0f172a';
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 3;
    ctx.fill();
    ctx.stroke();

    // Draw central inner dot
    ctx.beginPath();
    ctx.arc(center, center, 8, 0, 2 * Math.PI);
    ctx.fillStyle = '#38bdf8';
    ctx.fill();
  };

  // Mutation to execute Gacha Spin on Server
  const spinMutation = useMutation({
    mutationFn: async () => {
      setErrorMsg('');
      const res = await fetch('/api/gacha/spin', { method: 'POST' });
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
    if (spinning || prizes.length === 0) return;
    if (!session) {
      setErrorMsg('กรุณาเข้าสู่ระบบก่อนหมุนวงล้อ');
      return;
    }
    if (session.user.balance < 30) {
      setErrorMsg('ยอดเงินของคุณไม่เพียงพอ กรุณาเติมเงิน (ราคา 30 THB)');
      return;
    }

    setSpinning(true);
    spinMutation.mutate();
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
    const baseRotations = 5 + Math.floor(Math.random() * 3); // 5 to 7 full spins
    const targetSliceCenter = targetIdx * arcAngle + arcAngle / 2;
    const targetAngle = 2 * Math.PI * baseRotations - targetSliceCenter - Math.PI / 2;

    let startTime = null;
    const duration = 6000; // 6 seconds spin duration
    let lastTickAngle = 0;

    const tickIntervalAngle = arcAngle; // Tick sound plays whenever wheel rotation crosses slice width

    const loop = (timestamp) => {
      if (!startTime) startTime = timestamp;
      const elapsed = timestamp - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Cubic Ease-Out deceleration easing
      const easeProgress = 1 - Math.pow(1 - progress, 4);
      const currentAngle = easeProgress * targetAngle;

      // Play audio ticks during rotation
      const deltaAngle = Math.abs(currentAngle - lastTickAngle);
      if (deltaAngle >= tickIntervalAngle) {
        playTickSound();
        lastTickAngle = currentAngle;
      }

      drawWheel(currentAngle);

      if (progress < 1) {
        requestAnimationFrame(loop);
      } else {
        // Animation finished
        setSpinning(false);
        setSpinResult(result);
        
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
      <Navbar onOpenContact={() => setContactOpen(true)} onOpenHistory={() => setHistoryOpen(true)} />

      {/* Main Gacha Layout */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10 relative z-10 grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Col & Mid Col: Lucky Wheel board */}
        <div className="lg:col-span-2 flex flex-col items-center justify-center space-y-6">
          
          {/* Header Title */}
          <div className="text-center space-y-2">
            <span className="inline-flex items-center gap-1 bg-sky-500/10 border border-sky-500/20 px-3 py-1 rounded-full text-xs font-black text-sky-400 uppercase tracking-widest animate-pulse">
              <Sparkles className="w-3.5 h-3.5" />
              Gacha Lucky Wheel
            </span>
            <h1 className="text-2xl sm:text-4xl font-black text-white glow-text">วงล้อนำโชคนากาตะ</h1>
            <p className="text-xs text-zinc-400">เสี่ยงโชคลุ้นรับ คีย์เน็ตฟลิกซ์ บัตรสตรีม บัตรโรบล็อก หรือคูปองเงินคืน ในราคาเพียง 30 บาทต่อสปิน!</p>
          </div>

          {errorMsg && (
            <div className="max-w-md w-full bg-red-500/10 border border-red-500/20 px-4 py-2.5 rounded-xl text-xs text-red-400 flex items-center gap-1.5 justify-center">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Wheel Visual Canvas Container */}
          <div className="relative w-[320px] h-[320px] sm:w-[400px] sm:h-[400px] bg-zinc-950/20 backdrop-blur-md rounded-full border border-white/5 flex items-center justify-center p-4">
            
            {/* Spinning Canvas */}
            <canvas 
              ref={canvasRef} 
              width={400} 
              height={400} 
              className="w-full h-full rounded-full transition-transform"
            />

            {/* Top Indicator Triangle Arrow */}
            <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[14px] border-l-transparent border-r-[14px] border-r-transparent border-t-[22px] border-t-sky-400 filter drop-shadow-[0_2px_8px_rgba(56,189,248,0.5)] z-20" />
          </div>

          {/* Action Button & Sound toggle */}
          <div className="flex flex-col sm:flex-row items-center gap-4 w-full justify-center">
            
            {/* Spin CTA Button */}
            <button
              onClick={handleSpinClick}
              disabled={spinning || isLoading || prizes.length === 0}
              className="w-full sm:w-[220px] flex items-center justify-center gap-1.5 bg-sky-500 text-sky-950 font-black py-3.5 px-6 rounded-xl hover:bg-sky-400 hover:scale-[1.02] disabled:opacity-50 disabled:pointer-events-none transition-all text-xs tracking-wider glow-btn cursor-pointer"
            >
              {spinning ? (
                <>
                  <Loader2 className="w-4.5 h-4.5 animate-spin" />
                  <span>กำลังหมุนลุ้นรางวัล...</span>
                </>
              ) : (
                <>
                  <Award className="w-4.5 h-4.5" />
                  <span>หมุนวงล้อ (30 THB)</span>
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

        </div>

        {/* Right Col: Recent Winners Dashboard */}
        <div className="glass p-6 border border-white/5 rounded-2xl flex flex-col h-[500px]">
          
          <div className="pb-3 border-b border-white/5 mb-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
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
              {winners.map((win) => {
                const hiddenUsername = win.username.length > 4 
                  ? win.username.substring(0, 3) + '***' + win.username.substring(win.username.length - 2)
                  : win.username[0] + '***';

                return (
                  <div 
                    key={win._id} 
                    className="flex items-center justify-between p-3 rounded-xl border border-white/5 bg-zinc-950/20 hover:bg-white/5 transition-colors text-xs"
                  >
                    <div className="space-y-0.5">
                      <span className="font-bold text-white block">{hiddenUsername}</span>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
          <div className="absolute inset-0" onClick={() => setSpinResult(null)} />
          
          <div className="relative w-full max-w-md bg-[#060c13] border border-sky-500/20 p-6 rounded-2xl shadow-2xl glass z-10 text-center overflow-hidden animate-in fade-in zoom-in-95 duration-300">
            
            {/* Glow behind popup */}
            <div className="absolute -top-12 -right-12 w-40 h-40 bg-sky-500/10 rounded-full blur-3xl" />

            {spinResult.type === 'empty' ? (
              /* EMPTY RESULT */
              <div className="space-y-5 py-4">
                <div className="inline-flex bg-zinc-800 border border-zinc-700 p-4 rounded-full text-zinc-400 mx-auto">
                  <AlertCircle className="w-12 h-12" />
                </div>
                
                <div className="space-y-1.5">
                  <h2 className="text-xl font-bold text-zinc-300">เกลือจ้า! โอกาสหน้าลองใหม่</h2>
                  <p className="text-xs text-zinc-500 px-4 leading-relaxed">
                    น่าเสียดายที่สปินรอบนี้ไม่ได้รับของรางวัล ยอดเงินของคุณถูกหัก 30 บาท วงล้อนำโชคยินดีต้อนรับคุณอีกครั้ง!
                  </p>
                </div>

                <button
                  onClick={() => setSpinResult(null)}
                  className="w-full bg-zinc-800 text-zinc-300 hover:text-white py-3 rounded-xl font-bold text-xs cursor-pointer transition-colors"
                >
                  ปิดหน้าต่าง
                </button>
              </div>
            ) : (
              /* CODE OR COUPON AWARD RESULT */
              <div className="space-y-5 py-4">
                <div className="inline-flex bg-sky-500/10 border border-sky-500/20 p-4 rounded-full text-sky-400 mx-auto animate-bounce">
                  <CheckCircle className="w-12 h-12" />
                </div>
                
                <div className="space-y-1.5">
                  <span className="text-[10px] text-sky-400 font-bold uppercase tracking-wider">ยินดีด้วยคุณได้รับรางวัล!</span>
                  <h2 className="text-xl font-black text-white glow-text">{spinResult.prizeName}</h2>
                </div>

                {/* Received code box */}
                <div className="bg-zinc-950/60 border border-white/5 p-4 rounded-xl text-left space-y-2">
                  <span className="text-[9px] uppercase font-bold text-sky-400 tracking-wider flex items-center gap-1">
                    <Ticket className="w-3.5 h-3.5" />
                    ข้อมูลของรางวัลที่ได้รับ
                  </span>

                  <div className="flex items-center justify-between gap-3 bg-white/5 border border-white/5 px-3.5 py-2.5 rounded-lg text-xs font-mono text-zinc-100 break-all select-all">
                    <span>{spinResult.wonValue}</span>
                    <button
                      onClick={() => handleCopy(spinResult.wonValue)}
                      className="shrink-0 text-sky-400 hover:text-sky-300 p-1.5 hover:bg-white/5 rounded transition-colors cursor-pointer"
                    >
                      {copied ? (
                        <Check className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                <p className="text-[10px] text-zinc-500">
                  * หากเป็นคูปองสามารถก๊อปปี้ไปป้อนใส่ช่องลดราคาตอนซื้อสินค้าได้ทันที ประวัติบันทึกลงในบิลทรานแซกชั่นแล้ว
                </p>

                <button
                  onClick={() => setSpinResult(null)}
                  className="w-full bg-sky-500 text-sky-950 hover:bg-sky-400 py-3 rounded-xl font-bold text-xs cursor-pointer transition-all glow-btn"
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
    </div>
  );
}
