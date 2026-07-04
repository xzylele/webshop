'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useQuery } from '@tanstack/react-query';
import { Clock, Wallet, ShoppingBag, Copy, Check, Search, Award, RefreshCw, LogIn, AlertCircle, MessageSquare } from 'lucide-react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import CanvasBackground from '../components/CanvasBackground';
import { getUserRank, RANKS } from '@/lib/ranks';
import Link from 'next/link';

export default function InventoryPage() {
  const { data: session, status } = useSession();
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('all'); // 'all', 'purchase', 'topup'
  const [copiedId, setCopiedId] = useState(null);

  // Fetch transactions using react-query
  const { data: transactions = [], isLoading, error, refetch } = useQuery({
    queryKey: ['transactions'],
    queryFn: async () => {
      const res = await fetch('/api/transactions');
      if (!res.ok) throw new Error('เกิดข้อผิดพลาดในการโหลดประวัติ');
      return res.json();
    },
    enabled: !!session,
  });

  // ดึงข้อมูลคูปองสะสมของตนเอง
  const { data: coupons = [], isLoading: couponsLoading, error: couponsError, refetch: refetchCoupons } = useQuery({
    queryKey: ['my-coupons'],
    queryFn: async () => {
      const res = await fetch('/api/coupons/my-coupons');
      if (!res.ok) throw new Error('เกิดข้อผิดพลาดในการโหลดคูปองสะสม');
      return res.json();
    },
    enabled: !!session,
  });

  const handleCopy = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleRefresh = () => {
    refetch();
    refetchCoupons();
  };

  // VIP Rank logic
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

  // Filters
  const filteredTransactions = transactions.filter(tx => {
    // 1. Tab filter
    if (activeTab !== 'all' && tx.type !== activeTab) {
      return false;
    }
    // 2. Search filter
    if (search.trim() !== '') {
      const searchLower = search.toLowerCase();
      return tx.description.toLowerCase().includes(searchLower);
    }
    return true;
  });

  return (
    <div className="relative min-h-screen bg-[#02060d] text-white flex flex-col font-sans">
      <CanvasBackground />
      <Navbar />

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-8 relative z-10 space-y-8">
        
        {/* Page Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-black bg-gradient-to-r from-sky-400 via-blue-500 to-purple-500 bg-clip-text text-transparent leading-normal">
              คลังสินค้า & ประวัติการทำรายการ
            </h1>
            <p className="text-sm text-zinc-400">
              ตรวจสอบคีย์สินค้า โค้ดรางวัล และประวัติการเงินของคุณ
            </p>
          </div>
          {session && (
            <button
              onClick={handleRefresh}
              className="flex items-center gap-2 text-xs font-semibold text-sky-400 bg-sky-950/20 border border-sky-500/10 hover:border-sky-500/30 px-4 py-2 rounded-xl transition-all cursor-pointer hover:bg-sky-950/40"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              ดึงข้อมูลล่าสุด
            </button>
          )}
        </div>

        {status === 'loading' ? (
          <div className="flex flex-col items-center justify-center py-32 gap-3 bg-zinc-950/20 border border-white/5 rounded-2xl backdrop-blur-md">
            <div className="w-10 h-10 border-4 border-sky-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-zinc-400">กำลังยืนยันตัวตน...</p>
          </div>
        ) : !session ? (
          /* Sign In Reminder Card */
          <div className="flex flex-col items-center justify-center py-20 px-6 text-center max-w-md mx-auto bg-zinc-950/45 border border-white/5 rounded-3xl backdrop-blur-md space-y-6">
            <div className="bg-red-500/10 p-4 rounded-full text-red-400">
              <AlertCircle className="w-12 h-12" />
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-bold">กรุณาเข้าสู่ระบบ</h2>
              <p className="text-sm text-zinc-400 leading-relaxed">
                คุณจำเป็นต้องเข้าสู่ระบบสมาชิกเพื่อเข้าถึงข้อมูลประวัติการซื้อรหัสคีย์สินค้าและการทำรายการเติมเงินของคุณ
              </p>
            </div>
            <Link
              href="/auth/signin"
              className="w-full flex items-center justify-center gap-2 text-sm font-bold bg-sky-500 text-sky-950 hover:bg-sky-400 py-3 rounded-xl transition-all glow-btn"
            >
              <LogIn className="w-4 h-4" />
              เข้าสู่ระบบตอนนี้
            </Link>
          </div>
        ) : (
          /* Logged In Content */
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* Left Column: VIP Card & Stats */}
            <div className="space-y-6 lg:col-span-1">
              
              {/* VIP Card */}
              {userRank && (
                <div className="bg-zinc-950/40 border border-white/5 rounded-3xl p-6 backdrop-blur-md space-y-6 shadow-xl relative overflow-hidden group">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-sky-500/5 rounded-full blur-3xl group-hover:bg-sky-500/10 transition-all duration-500" />
                  
                  <div className="flex items-center gap-3">
                    <div className="bg-gradient-to-r from-sky-500 to-blue-600 p-3 rounded-2xl text-sky-950">
                      <Award className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-xs text-zinc-500 font-bold uppercase tracking-wider">ระดับสมาชิก</h3>
                      <p className="text-lg font-black text-white">{userRank.name}</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between items-center text-xs text-zinc-400">
                      <span>ยอดซื้อสะสม:</span>
                      <span className="font-mono text-white font-bold">{currentSpent.toLocaleString()} THB</span>
                    </div>
                    <div className="flex justify-between items-center text-xs text-zinc-400">
                      <span>ส่วนลดสมาชิก VIP:</span>
                      <span className="font-mono text-purple-400 font-bold">{userRank.discountPercent}%</span>
                    </div>
                  </div>

                  {/* Progress to next rank */}
                  <div className="space-y-3 pt-4 border-t border-white/5">
                    <div className="flex justify-between items-center text-xs text-zinc-400 font-semibold">
                      <span>ความคืบหน้ายศยศถัดไป</span>
                      {nextRank ? (
                        <span className="text-purple-400 font-mono">
                          {currentSpent.toLocaleString()} / {nextRank.minSpent.toLocaleString()}
                        </span>
                      ) : (
                        <span className="text-amber-400 font-bold">ยศสูงสุด</span>
                      )}
                    </div>

                    <div className="relative w-full h-3 bg-zinc-900 border border-white/5 rounded-full overflow-hidden">
                      <div 
                        className="absolute top-0 left-0 h-full rounded-full bg-gradient-to-r from-sky-500 via-blue-500 to-purple-500 transition-all duration-500"
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>

                    <p className="text-[10px] text-zinc-500 leading-normal text-center">
                      {nextRank ? (
                        <>สะสมเพิ่มอีก <strong className="text-sky-400">{spentNeeded.toLocaleString()} THB</strong> เพื่อเลื่อนเป็น <strong className="text-purple-400">{nextRank.name}</strong></>
                      ) : (
                        <span className="text-amber-400 font-semibold">⭐ ท่านมียศสูงสุดและส่วนลดระดับพิเศษแล้ว ⭐</span>
                      )}
                    </p>
                  </div>
                </div>
              )}

              {/* Balance Summary Card */}
              <div className="bg-zinc-950/40 border border-white/5 rounded-3xl p-6 backdrop-blur-md space-y-4">
                <h3 className="text-xs text-zinc-500 font-bold uppercase tracking-wider">กระเป๋าเงินของคุณ</h3>
                <div className="flex justify-between items-baseline">
                  <span className="text-4xl font-black text-sky-400 font-mono">
                    {session.user.balance?.toLocaleString()}
                  </span>
                  <span className="text-xs font-bold text-sky-400">THB</span>
                </div>
                <Link
                  href="/topup"
                  className="w-full flex items-center justify-center gap-2 text-xs font-bold bg-sky-500/10 text-sky-400 border border-sky-500/20 hover:bg-sky-500/20 py-3 rounded-xl transition-all cursor-pointer"
                >
                  <Wallet className="w-4 h-4" />
                  เติมเงินเข้าเครดิต
                </Link>
              </div>

            </div>

            {/* Right Column: Search, Filter, and Transaction Logs */}
            <div className="lg:col-span-2 space-y-6">
              
              {/* Search & Tabs Panel */}
              <div className="bg-zinc-950/45 border border-white/5 rounded-3xl p-5 backdrop-blur-md flex flex-col md:flex-row gap-4 items-center justify-between">
                
                {/* Tabs */}
                <div className="flex bg-zinc-900 border border-white/5 p-1 rounded-xl w-full md:w-auto font-sans">
                  {[
                    { id: 'all', label: 'ทั้งหมด' },
                    { id: 'purchase', label: 'คีย์สินค้าที่ซื้อ' },
                    { id: 'topup', label: 'รายการเติมเงิน' },
                    { id: 'coupons', label: 'คูปองของฉัน' }
                  ].map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`flex-1 md:flex-initial text-xs font-bold px-4 py-2 rounded-lg transition-all cursor-pointer ${
                        activeTab === tab.id
                          ? 'bg-sky-500 text-sky-950 shadow-lg'
                          : 'text-zinc-400 hover:text-white'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* Search Bar */}
                <div className="relative w-full md:w-64">
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="ค้นหาชื่อสินค้าหรือคีย์..."
                    className="w-full bg-zinc-900 border border-white/5 text-zinc-200 placeholder-zinc-500 text-xs px-4 py-2.5 pl-9 rounded-xl outline-none focus:border-sky-500/30 transition-all font-medium"
                  />
                  <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-3" />
                </div>

              </div>

              {/* Transactions or Coupons List */}
              <div className="space-y-4">
                {activeTab === 'coupons' ? (
                  couponsLoading ? (
                    <div className="flex flex-col items-center justify-center py-24 gap-3 bg-zinc-950/20 border border-white/5 rounded-3xl backdrop-blur-md">
                      <div className="w-8 h-8 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" />
                      <p className="text-xs text-zinc-500">กำลังโหลดคูปองของคุณ...</p>
                    </div>
                  ) : couponsError ? (
                    <div className="text-center py-20 text-xs text-red-400 bg-zinc-950/20 border border-white/5 rounded-3xl">
                      {couponsError.message || 'เกิดข้อผิดพลาดในการโหลดคูปอง'}
                    </div>
                  ) : coupons.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-28 text-zinc-500 gap-3 bg-zinc-950/25 border border-white/5 rounded-3xl">
                      <Award className="w-12 h-12 stroke-[1.2] text-zinc-600" />
                      <p className="text-sm font-medium">คุณยังไม่มีคูปองส่วนลดสะสม</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {coupons.map((cp) => {
                        const isUsed = cp.status === 'used';
                        const isExpired = cp.status === 'expired';
                        const isInactive = cp.status === 'inactive';
                        
                        return (
                          <div
                            key={cp.id}
                            className={`relative overflow-hidden bg-zinc-950/40 border rounded-3xl p-5 backdrop-blur-md flex flex-col justify-between gap-4 transition-all hover:border-white/10 ${
                              isUsed ? 'opacity-50 border-white/5' : isExpired || isInactive ? 'border-red-500/10' : 'border-sky-500/20'
                            }`}
                          >
                            {/* Ticket cutout decoration */}
                            <div className="absolute top-1/2 -left-2 w-4 h-4 bg-[#02060d] border-r border-white/5 rounded-full -translate-y-1/2 z-10" />
                            <div className="absolute top-1/2 -right-2 w-4 h-4 bg-[#02060d] border-l border-white/5 rounded-full -translate-y-1/2 z-10" />

                            <div className="space-y-2">
                              <div className="flex justify-between items-start">
                                <div>
                                  <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">รหัสคูปองส่วนลด</span>
                                  <h4 className="text-lg font-black text-sky-400 tracking-wider font-mono">
                                    {cp.code}
                                  </h4>
                                </div>
                                <span
                                  className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border ${
                                    isUsed
                                      ? 'bg-zinc-800 text-zinc-400 border-zinc-700'
                                      : isExpired || isInactive
                                      ? 'bg-red-500/10 text-red-400 border-red-500/10'
                                      : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 animate-pulse'
                                  }`}
                                >
                                  {isUsed ? 'ใช้แล้ว' : isExpired ? 'หมดอายุ' : isInactive ? 'ปิดใช้งาน' : 'พร้อมใช้งาน'}
                                </span>
                              </div>

                              <div className="space-y-1 pt-1">
                                <div className="flex items-baseline gap-1 text-2xl font-black text-white font-mono">
                                  {cp.discount.toLocaleString()}
                                  <span className="text-xs font-bold text-zinc-400 font-sans">
                                    {cp.type === 'percentage' ? '%' : 'บาท'}
                                  </span>
                                </div>
                                <p className="text-xs text-zinc-400 leading-normal">
                                  {cp.type === 'percentage'
                                    ? `ลด ${cp.discount}% ${cp.maxDiscount ? `(สูงสุด ${cp.maxDiscount} บาท)` : ''}`
                                    : `ลดทันที ${cp.discount} บาท`
                                  } · ขั้นต่ำ {cp.minPurchase} บาท
                                </p>
                              </div>
                            </div>

                            <div className="border-t border-white/5 pt-3 flex justify-between items-center text-[10px] text-zinc-500">
                              <span>
                                {cp.expiresAt ? `หมดอายุ: ${new Date(cp.expiresAt).toLocaleDateString('th-TH')}` : 'ไม่มีวันหมดอายุ'}
                              </span>
                              {!isUsed && !isExpired && !isInactive && (
                                <button
                                  onClick={() => handleCopy(cp.code, cp.id)}
                                  className="flex items-center gap-1.5 text-[10px] font-bold text-sky-400 hover:text-sky-300 bg-sky-950/20 hover:bg-sky-950/40 border border-sky-500/10 hover:border-sky-500/30 px-2.5 py-1.5 rounded-xl transition-all cursor-pointer"
                                >
                                  {copiedId === cp.id ? (
                                    <>
                                      <Check className="w-3 h-3 text-emerald-400" />
                                      <span className="text-emerald-400">คัดลอกแล้ว</span>
                                    </>
                                  ) : (
                                    <>
                                      <Copy className="w-3 h-3" />
                                      <span>คัดลอกรหัส</span>
                                    </>
                                  )}
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )
                ) : isLoading ? (
                  <div className="flex flex-col items-center justify-center py-24 gap-3 bg-zinc-950/20 border border-white/5 rounded-3xl backdrop-blur-md">
                    <div className="w-8 h-8 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" />
                    <p className="text-xs text-zinc-500">กำลังโหลดรายการ...</p>
                  </div>
                ) : error ? (
                  <div className="text-center py-20 text-xs text-red-400 bg-zinc-950/20 border border-white/5 rounded-3xl">
                    {error.message || 'เกิดข้อผิดพลาดในการโหลดรายการ'}
                  </div>
                ) : filteredTransactions.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-28 text-zinc-500 gap-3 bg-zinc-950/25 border border-white/5 rounded-3xl">
                    <Clock className="w-12 h-12 stroke-[1.2] text-zinc-600" />
                    <p className="text-sm font-medium">ไม่พบประวัติรายการที่ค้นหา</p>
                  </div>
                ) : (
                  filteredTransactions.map((tx) => {
                    const isPurchase = tx.type === 'purchase';
                    const dateStr = new Date(tx.createdAt).toLocaleString('th-TH', {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    });

                    return (
                      <div
                        key={tx._id}
                        className="bg-zinc-950/40 border border-white/5 rounded-3xl p-5 backdrop-blur-md flex flex-col md:flex-row md:items-center justify-between gap-6 transition-all hover:border-white/10"
                      >
                        <div className="space-y-3 flex-1">
                          
                          <div className="flex items-center gap-3">
                            <span
                              className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 ${
                                isPurchase
                                  ? 'bg-red-500/10 text-red-400 border border-red-500/10'
                                  : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/10'
                              }`}
                            >
                              {isPurchase ? (
                                <>
                                  <ShoppingBag className="w-3 h-3" />
                                  คีย์การ์ด/สินค้า
                                </>
                              ) : (
                                <>
                                  <Wallet className="w-3 h-3" />
                                  เติมเครดิต
                                </>
                              )}
                            </span>
                            <span className="text-[10px] text-zinc-500 font-mono font-medium">{dateStr}</span>
                          </div>

                          <div className="text-sm text-zinc-200 font-medium whitespace-pre-line leading-relaxed font-mono">
                            {tx.description}
                          </div>

                        </div>

                        <div className="flex flex-row md:flex-col items-center md:items-end justify-between gap-3 border-t md:border-t-0 pt-3 md:pt-0 border-white/5">
                          
                          {/* Cost/Amount */}
                          <div
                            className={`text-lg font-black font-mono ${
                              isPurchase ? 'text-red-400' : 'text-emerald-400'
                            }`}
                          >
                            {isPurchase ? '' : '+'}
                            {tx.amount.toLocaleString()} THB
                          </div>

                          {/* Copy button if it is a purchase */}
                          {isPurchase && (
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleCopy(tx.description, tx._id)}
                                className="flex items-center gap-1.5 text-xs font-bold text-sky-400 hover:text-sky-300 bg-sky-950/20 hover:bg-sky-950/40 border border-sky-500/10 hover:border-sky-500/30 px-3 py-2 rounded-xl transition-all cursor-pointer"
                              >
                                {copiedId === tx._id ? (
                                  <>
                                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                                    <span className="text-emerald-400">คัดลอกแล้ว</span>
                                  </>
                                ) : (
                                  <>
                                    <Copy className="w-3.5 h-3.5" />
                                    <span>คัดลอกคีย์</span>
                                  </>
                                )}
                              </button>
                              <Link
                                href={(() => {
                                  const lines = (tx.description || '').split('\n');
                                  const firstLine = lines[0] || '';
                                  let productName = '';

                                  if (firstLine.startsWith('ซื้อสินค้า:')) {
                                    // Single purchase: "ซื้อสินค้า: Netflix Premium x1..."
                                    productName = firstLine.replace(/^ซื้อสินค้า:\s*/, '').replace(/\s*x\d+.*$/, '').trim();
                                  } else if (firstLine.startsWith('ชำระเงินตะกร้าสินค้า')) {
                                    // Cart purchase: lines like "- Netflix Premium x1"
                                    const productLines = lines.filter(l => l.trim().startsWith('- '));
                                    const names = productLines.map(l => l.trim().replace(/^-\s*/, '').replace(/\s*x\d+.*$/, '').trim());
                                    productName = names.join(', ');
                                  } else {
                                    productName = firstLine;
                                  }

                                  return `/tickets?report=true&txId=${tx._id}&product=${encodeURIComponent(productName)}&desc=${encodeURIComponent(firstLine)}&amount=${tx.amount}`;
                                })()}
                                className="flex items-center gap-1.5 text-xs font-bold text-amber-400 hover:text-amber-300 bg-amber-950/20 hover:bg-amber-950/40 border border-amber-500/10 hover:border-amber-500/30 px-3 py-2 rounded-xl transition-all cursor-pointer"
                                title="แจ้งปัญหาเกี่ยวกับรายการนี้"
                              >
                                <MessageSquare className="w-3.5 h-3.5" />
                                <span>แจ้งปัญหา</span>
                              </Link>
                            </div>
                          )}

                        </div>

                      </div>
                    );
                  })
                )}
              </div>

            </div>

          </div>
        )}

      </main>

      <Footer />
    </div>
  );
}
