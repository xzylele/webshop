'use client';

import { X, Clock, Wallet, ShoppingBag, Copy, Check, Award } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { getUserRank, RANKS } from '@/lib/ranks';

export default function HistoryModal({ isOpen, onClose }) {
  const { data: session } = useSession();
  const [copiedId, setCopiedId] = useState(null);

  const { data: transactions = [], isLoading, error } = useQuery({
    queryKey: ['transactions'],
    queryFn: async () => {
      const res = await fetch('/api/transactions');
      if (!res.ok) throw new Error('เกิดข้อผิดพลาดในการโหลดประวัติ');
      return res.json();
    },
    enabled: isOpen,
  });

  const handleCopy = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (!isOpen) return null;

  // คำนวณระดับยศสมาชิกร่วมกัน
  const currentSpent = session?.user?.totalSpent || 0;
  const userRank = session?.user ? getUserRank(currentSpent) : null;
  const currentRankIdx = userRank ? RANKS.findIndex(r => r.name === userRank.name) : 0;
  const nextRank = userRank && currentRankIdx < RANKS.length - 1 ? RANKS[currentRankIdx + 1] : null;

  let progressPercent = 0;
  let spentNeeded = 0;
  if (userRank) {
    if (nextRank) {
      const minCurrent = userRank.minSpent;
      const minNext = nextRank.minSpent;
      const progressAmount = currentSpent - minCurrent;
      const range = minNext - minCurrent;
      progressPercent = Math.min(100, Math.max(0, (progressAmount / range) * 100));
      spentNeeded = minNext - currentSpent;
    } else {
      progressPercent = 100;
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
      <div className="absolute inset-0" onClick={onClose} />

      <div className="relative w-full max-w-2xl bg-[#060c13] border border-white/5 p-6 rounded-2xl shadow-2xl glass z-10 flex flex-col max-h-[85vh] transition-all animate-in fade-in zoom-in-95 duration-200">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg border border-white/5 text-zinc-400 hover:text-white hover:bg-white/5 cursor-pointer transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="bg-sky-500/10 p-2.5 rounded-xl text-sky-400">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white leading-tight">ประวัติการทำรายการ</h2>
            <p className="text-xs text-zinc-400">ดูทรานแซกชั่นเติมเงินและข้อมูลรหัสสินค้าที่เคยสั่งซื้อ</p>
          </div>
        </div>

        {/* VIP Rank Progress Card */}
        {session?.user && userRank && (
          <div className="bg-zinc-950/40 border border-white/5 p-4 rounded-xl space-y-3.5 mb-5">
            <div className="flex justify-between items-center text-xs">
              <div className="flex items-center gap-2">
                <span className="text-zinc-400">ระดับยศปัจจุบัน:</span>
                <span className={`inline-flex items-center text-[9px] font-black px-2 py-0.5 rounded border tracking-wider select-none ${userRank.color}`}>
                  {userRank.badge}
                </span>
                {userRank.discountPercent > 0 && (
                  <span className="text-[10px] text-purple-400 font-semibold">(ส่วนลดถาวร {userRank.discountPercent}%)</span>
                )}
              </div>
              <span className="text-zinc-400 font-mono">สะสมแล้ว: <strong className="text-sky-400">{currentSpent.toLocaleString()}</strong> / {nextRank ? nextRank.minSpent.toLocaleString() : 'MAX'} THB</span>
            </div>

            {/* Cyberpunk Progress Bar */}
            <div className="relative w-full h-2.5 bg-zinc-900 border border-white/5 rounded-full overflow-hidden">
              <div 
                className="absolute top-0 left-0 h-full rounded-full bg-gradient-to-r from-sky-500 via-blue-500 to-purple-500 transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>

            <div className="flex justify-between items-center text-[10px] text-zinc-500 font-semibold">
              {nextRank ? (
                <>
                  <span>{userRank.name}</span>
                  <span className="text-purple-400">ขาดอีก {spentNeeded.toLocaleString()} THB เพื่อเลื่อนยศเป็น {nextRank.name}</span>
                  <span>{nextRank.name}</span>
                </>
              ) : (
                <span className="text-amber-400 w-full text-center">⭐ ท่านสมาชิกมียศสูงสุดของ NakataShop แล้ว ขอบคุณสำหรับการสนับสนุนระดับพิเศษ ⭐</span>
              )}
            </div>
          </div>
        )}

        {/* Modal Body: Transaction List */}
        <div className="flex-1 overflow-y-auto pr-1 space-y-3 min-h-[250px]">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <div className="w-8 h-8 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-xs text-zinc-500">กำลังโหลดประวัติทำรายการ...</p>
            </div>
          ) : error ? (
            <div className="text-center py-20 text-xs text-red-400">
              {error.message || 'ไม่สามารถดึงข้อมูลได้'}
            </div>
          ) : transactions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-zinc-500 gap-2">
              <Clock className="w-10 h-10 stroke-[1.5] text-zinc-600" />
              <p className="text-sm">ไม่มีประวัติการทำรายการในระบบ</p>
            </div>
          ) : (
            transactions.map((tx) => {
              const isPurchase = tx.type === 'purchase';
              const dateStr = new Date(tx.createdAt).toLocaleString('th-TH', {
                dateStyle: 'medium',
                timeStyle: 'short',
              });

              return (
                <div
                  key={tx._id}
                  className="bg-zinc-950/40 border border-white/5 p-4 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <div
                        className={`p-1.5 rounded-lg text-xs font-medium flex items-center gap-1 ${
                          isPurchase
                            ? 'bg-red-500/10 text-red-400 border border-red-500/10'
                            : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/10'
                        }`}
                      >
                        {isPurchase ? (
                          <>
                            <ShoppingBag className="w-3.5 h-3.5" />
                            <span>ซื้อสินค้า</span>
                          </>
                        ) : (
                          <>
                            <Wallet className="w-3.5 h-3.5" />
                            <span>เติมเงิน</span>
                          </>
                        )}
                      </div>
                      <span className="text-[11px] text-zinc-500">{dateStr}</span>
                    </div>

                    <div className="text-sm text-zinc-300 font-medium whitespace-pre-line leading-relaxed">
                      {tx.description}
                    </div>
                  </div>

                  <div className="flex flex-row md:flex-col items-center md:items-end justify-between gap-2 border-t md:border-t-0 pt-2 md:pt-0 border-white/5">
                    {/* Amount */}
                    <div
                      className={`text-base font-bold ${
                        isPurchase ? 'text-red-400' : 'text-emerald-400'
                      }`}
                    >
                      {isPurchase ? '' : '+'}
                      {tx.amount.toLocaleString()} THB
                    </div>

                    {/* Action button if code can be copied */}
                    {isPurchase && (
                      <button
                        onClick={() => handleCopy(tx.description, tx._id)}
                        className="flex items-center gap-1.5 text-xs text-sky-400 hover:text-sky-300 bg-sky-950/20 hover:bg-sky-950/40 border border-sky-500/10 hover:border-sky-500/30 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer"
                      >
                        {copiedId === tx._id ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                            <span className="text-emerald-400">คัดลอกแล้ว</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>คัดลอกโค้ด</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

      </div>
    </div>
  );
}
