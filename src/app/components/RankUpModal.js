'use client';

import { useEffect, useRef } from 'react';
import { Award, Sparkles, Wallet, Coins, X } from 'lucide-react';
import { RANKS } from '@/lib/ranks';

export default function RankUpModal({ isOpen, onClose, rankUpInfo }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animationFrameId;

    // ตั้งค่าขนาด Canvas เต็มจอ
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const colors = ['#f59e0b', '#3b82f6', '#10b981', '#ec4899', '#8b5cf6', '#06b6d4'];
    const confettiCount = 150;
    const confettis = [];

    for (let i = 0; i < confettiCount; i++) {
      confettis.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height - canvas.height,
        r: Math.random() * 6 + 4,
        d: Math.random() * canvas.height,
        color: colors[Math.floor(Math.random() * colors.length)],
        tilt: Math.random() * 10 - 5,
        tiltAngleIncremental: Math.random() * 0.07 + 0.02,
        tiltAngle: 0
      });
    }

    function draw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      confettis.forEach((c, idx) => {
        c.tiltAngle += c.tiltAngleIncremental;
        c.y += (Math.cos(c.d) + 3 + c.r / 2) / 2;
        c.x += Math.sin(c.tiltAngle);
        c.tilt = Math.sin(c.tiltAngle - idx / 3) * 15;

        // วาดรูปสี่เหลี่ยม confetti
        ctx.beginPath();
        ctx.lineWidth = c.r;
        ctx.strokeStyle = c.color;
        ctx.moveTo(c.x + c.tilt + c.r / 2, c.y);
        ctx.lineTo(c.x + c.tilt, c.y + c.tilt + c.r / 2);
        ctx.stroke();

        // รีเซ็ตตำแหน่งหากหลุดขอบจอ
        if (c.y > canvas.height) {
          confettis[idx] = {
            x: Math.random() * canvas.width,
            y: -20,
            r: c.r,
            d: c.d,
            color: c.color,
            tilt: Math.random() * 10 - 5,
            tiltAngleIncremental: c.tiltAngleIncremental,
            tiltAngle: 0
          };
        }
      });

      animationFrameId = requestAnimationFrame(draw);
    }

    draw();

    const handleResize = () => {
      if (canvas) {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
    };
  }, [isOpen]);

  if (!isOpen || !rankUpInfo) return null;

  const { from, to, creditReward, pointReward } = rankUpInfo;
  
  // หาสีและสไตล์ Badge ของ Rank ใหม่
  const newRankObj = RANKS.find(r => r.name === to) || RANKS[0];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 backdrop-blur-sm animate-[fadeIn_0.3s_ease-out]">
      {/* Canvas for Confetti */}
      <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none z-0" />

      {/* Main Modal Card */}
      <div className="relative w-full max-w-lg mx-4 bg-zinc-950/80 border border-amber-500/30 rounded-3xl p-8 text-center backdrop-blur-xl shadow-[0_0_50px_rgba(245,158,11,0.15)] z-10 animate-[zoomIn_0.3s_cubic-bezier(0.34,1.56,0.64,1)]">
        
        {/* Glow Radial effect */}
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl -z-10 animate-pulse" />

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full border border-white/5 hover:border-white/10 hover:bg-white/5 text-zinc-400 hover:text-white transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Icon Header */}
        <div className="relative inline-flex items-center justify-center p-5 bg-gradient-to-r from-amber-500 to-yellow-400 text-zinc-950 rounded-full shadow-[0_0_30px_rgba(245,158,11,0.4)] mb-6 animate-[bounce_1.5s_infinite]">
          <Award className="w-10 h-10 stroke-[2.5]" />
          <Sparkles className="absolute -top-1 -right-1 w-5 h-5 text-amber-300 animate-spin" />
        </div>

        {/* Header Text */}
        <div className="space-y-2 mb-6">
          <span className="text-[10px] font-black text-amber-400 uppercase tracking-widest block animate-pulse">RANK LEVEL UP!</span>
          <h2 className="text-3xl font-black text-white leading-tight">
            ยินดีด้วย คุณได้เลื่อนยศแล้ว!
          </h2>
          <p className="text-xs text-zinc-400">
            ยอดสะสมการสั่งซื้อของคุณถึงเกณฑ์ปลดล็อกสิทธิพิเศษระดับถัดไป
          </p>
        </div>

        {/* Rank Badge Showdown */}
        <div className="flex items-center justify-center gap-4 bg-zinc-900/60 border border-white/5 py-4 px-6 rounded-2xl mb-8">
          <div className="text-right">
            <span className="text-[9px] text-zinc-500 font-bold block">ยศเดิม</span>
            <span className="text-sm font-bold text-zinc-400">{from}</span>
          </div>
          <span className="text-amber-500 text-lg font-bold">➔</span>
          <div className="text-left">
            <span className="text-[9px] text-amber-500 font-bold block">ยศใหม่</span>
            <span className={`inline-flex items-center text-xs font-black px-2.5 py-0.5 rounded border tracking-wider mt-0.5 ${newRankObj.color}`}>
              {newRankObj.badge}
            </span>
          </div>
        </div>

        {/* Promotion Rewards details */}
        <div className="space-y-4 mb-8">
          <h3 className="text-xs text-zinc-400 font-bold uppercase tracking-wider">ของรางวัลสำหรับการเลื่อนยศ</h3>
          
          <div className="grid grid-cols-2 gap-4">
            {/* Wallet Cash reward */}
            <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-2xl p-4 flex flex-col items-center justify-center text-emerald-400">
              <div className="p-2 bg-emerald-500/10 rounded-xl mb-2">
                <Wallet className="w-5 h-5" />
              </div>
              <span className="text-[10px] text-zinc-400 font-bold">โบนัสเครดิตฟรี</span>
              <span className="text-lg font-black font-mono">+{creditReward} THB</span>
            </div>

            {/* Points reward */}
            <div className="bg-sky-500/5 border border-sky-500/20 rounded-2xl p-4 flex flex-col items-center justify-center text-sky-400">
              <div className="p-2 bg-sky-500/10 rounded-xl mb-2">
                <Coins className="w-5 h-5" />
              </div>
              <span className="text-[10px] text-zinc-400 font-bold">โบนัสแต้มพอยท์</span>
              <span className="text-lg font-black font-mono">+{pointReward} Points</span>
            </div>
          </div>
        </div>

        {/* Call to action */}
        <div className="space-y-3">
          <button
            onClick={onClose}
            className="w-full bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-zinc-950 text-sm font-black py-3.5 rounded-xl transition-all shadow-[0_4px_20px_rgba(245,158,11,0.25)] hover:shadow-[0_4px_25px_rgba(245,158,11,0.35)] cursor-pointer active:scale-95"
          >
            กดรับรางวัลและใช้งานต่อ
          </button>
          <span className="text-[9px] text-zinc-500 block leading-normal">
            * สิทธิ์ส่วนลดและอัตราตัวคูณแต้มใหม่จะมีผลบังคับใช้ในการทำรายการถัดไปทันที
          </span>
        </div>

      </div>
    </div>
  );
}
