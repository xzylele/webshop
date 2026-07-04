'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useQuery } from '@tanstack/react-query';
import { 
  Clock, 
  Wallet, 
  ShoppingBag, 
  Copy, 
  Check, 
  Search, 
  Award, 
  RefreshCw, 
  LogIn, 
  AlertCircle, 
  MessageSquare, 
  Ticket, 
  Calendar, 
  Tag, 
  CheckCircle,
  ExternalLink,
  ShieldCheck
} from 'lucide-react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import CanvasBackground from '../components/CanvasBackground';
import { getUserRank, RANKS } from '@/lib/ranks';
import Link from 'next/link';

// ─── ฟังก์ชันคัดแยกคีย์สินค้า/โค้ดรางวัลจากประวัติ ───
function parseKeysFromTransactions(transactionsList) {
  if (!transactionsList || !Array.isArray(transactionsList)) return [];
  const keys = [];

  transactionsList.forEach(tx => {
    if (tx.type !== 'purchase' || tx.status !== 'completed') return;

    const desc = tx.description || '';
    const lines = desc.split('\n').map(l => l.trim());
    const firstLine = lines[0] || '';

    // 1. ตรวจจับรางวัลจากการหมุนวงล้อ Gacha
    if (firstLine.startsWith('[สุ่มวงล้อ Gacha:')) {
      const match = firstLine.match(/\[สุ่มวงล้อ Gacha:\s*(.+?)\]\s*สุ่มได้:\s*(.+)/);
      if (match) {
        const tierName = match[1];
        const prizeName = match[2];

        // หากรางวัลไม่ใช่ของว่าง (เกลือ) ให้สกัดคีย์โค้ดบรรทัดถัดไป
        if (prizeName !== 'เกลือ' && prizeName !== 'เกลือจ้า' && !prizeName.includes('เกลือ')) {
          const codes = lines.slice(1).filter(l => l.length > 0);
          codes.forEach((code, idx) => {
            keys.push({
              id: `gacha-${tx.id}-${idx}`,
              txId: tx.id,
              name: prizeName,
              source: `Gacha (${tierName})`,
              code: code,
              date: tx.createdAt,
              price: tx.amount,
            });
          });
        }
      }
    }
    // 2. ตรวจจับการสั่งซื้อสินค้าผ่านระบบตะกร้า
    else if (firstLine.startsWith('ชำระเงินตะกร้าสินค้า')) {
      let currentProduct = '';
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        if (line.startsWith('- ')) {
          currentProduct = line.replace(/^-\s*/, '').replace(/\s*x\d+.*$/, '').trim();
        } else if (line.length > 0 && !line.startsWith('[รหัสโค้ด]') && !line.startsWith('(') && currentProduct) {
          const code = line.replace(/^\[รหัสโค้ด\]:?/, '').trim();
          if (code && code !== 'ไม่มีรหัสคีย์' && !code.startsWith('-') && !code.startsWith('(')) {
            keys.push({
              id: `cart-${tx.id}-${i}`,
              txId: tx.id,
              name: currentProduct,
              source: 'ซื้อผ่านตะกร้า',
              code: code,
              date: tx.createdAt,
              price: tx.amount,
            });
          }
        }
      }
    }
    // 3. ตรวจจับการซื้อตรงเดี่ยว ๆ (ไม่ได้ผ่านตะกร้า)
    else if (firstLine.startsWith('ซื้อสินค้า:')) {
      const productName = firstLine.replace(/^ซื้อสินค้า:\s*/, '').replace(/\s*x\d+.*$/, '').replace(/\s*\(.*$/, '').trim();
      const codes = lines.slice(1).filter(l => l.length > 0 && !l.startsWith('(') && !l.startsWith('['));
      codes.forEach((code, idx) => {
        keys.push({
          id: `single-${tx.id}-${idx}`,
          txId: tx.id,
          name: productName,
          source: 'ซื้อโดยตรง',
          code: code,
          date: tx.createdAt,
          price: tx.amount,
        });
      });
    }
  });

  return keys;
}

export default function InventoryPage() {
  const { data: session, status } = useSession();
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('keys'); // 'keys', 'coupons', 'billing', 'all'
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

  // แยกคีย์สินค้าและของรางวัลจากธุรกรรมทั้งหมด
  const parsedKeys = parseKeysFromTransactions(transactions);

  // การกรองข้อมูลแยกตามแท็บที่เลือกและช่องค้นหา (Search)
  const filteredKeys = parsedKeys.filter(k => {
    if (!search.trim()) return true;
    const s = search.toLowerCase();
    return k.name.toLowerCase().includes(s) || k.code.toLowerCase().includes(s) || k.source.toLowerCase().includes(s);
  });

  const filteredCoupons = coupons.filter(c => {
    if (!search.trim()) return true;
    const s = search.toLowerCase();
    return c.code.toLowerCase().includes(s) || c.status.toLowerCase().includes(s);
  });

  const filteredBilling = transactions.filter(tx => {
    // กรองประวัติการเงิน
    if (activeTab === 'billing' || activeTab === 'all') {
      if (activeTab === 'billing' && tx.type === 'all') return false; // placeholder guard
      if (!search.trim()) return true;
      const s = search.toLowerCase();
      return tx.description.toLowerCase().includes(s) || tx.type.toLowerCase().includes(s);
    }
    return true;
  });

  return (
    <div className="relative min-h-screen bg-[#02060d] text-white flex flex-col font-sans">
      <CanvasBackground />
      <Navbar />

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-8 relative z-10 space-y-8">
        
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-white/5 pb-6">
          <div>
            <h1 className="text-3xl font-black bg-gradient-to-r from-sky-400 via-blue-500 to-purple-500 bg-clip-text text-transparent leading-normal">
              คลังส่วนตัว & ประวัติสะสม (Inventory Showcase)
            </h1>
            <p className="text-xs text-zinc-400">
              ตรวจสอบข้อมูลรหัสบัตรเติมเงิน คีย์สตรีมมิ่งที่ซื้อ รางวัลหมุนกาชา และบิลประวัติการชำระเงินของคุณได้ทันที
            </p>
          </div>
          {session && (
            <button
              onClick={handleRefresh}
              className="flex items-center gap-1.5 text-xs font-bold text-sky-400 bg-sky-950/20 border border-sky-500/10 hover:border-sky-500/30 px-4 py-2.5 rounded-xl transition-all cursor-pointer hover:bg-sky-950/40 hover:scale-[1.01] active:scale-[0.99]"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>ดึงข้อมูลล่าสุด</span>
            </button>
          )}
        </div>

        {status === 'loading' ? (
          <div className="flex flex-col items-center justify-center py-32 gap-3 bg-zinc-950/20 border border-white/5 rounded-3xl backdrop-blur-md">
            <div className="w-10 h-10 border-4 border-sky-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-zinc-400">กำลังดึงข้อมูลสมาชิก...</p>
          </div>
        ) : !session ? (
          /* Sign In Reminder Card */
          <div className="flex flex-col items-center justify-center py-20 px-6 text-center max-w-md mx-auto bg-zinc-950/45 border border-white/5 rounded-3xl backdrop-blur-md space-y-6">
            <div className="bg-red-500/10 p-4 rounded-full text-red-400">
              <AlertCircle className="w-12 h-12" />
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-bold">กรุณาเข้าสู่ระบบก่อน</h2>
              <p className="text-xs text-zinc-400 leading-relaxed">
                คุณจำเป็นต้องเข้าสู่ระบบสมาชิก NakataShop เพื่อดูรายการรหัสสินค้าที่เคยสั่งซื้อและตรวจเช็คคลังไอเทมของคุณ
              </p>
            </div>
            <Link
              href="/auth/signin"
              className="w-full flex items-center justify-center gap-2 text-sm font-bold bg-sky-500 text-sky-950 hover:bg-sky-400 py-3.5 rounded-xl transition-all glow-btn"
            >
              <LogIn className="w-4 h-4" />
              <span>เข้าสู่ระบบตอนนี้</span>
            </Link>
          </div>
        ) : (
          /* Logged In Content */
          <div className="space-y-8">
            
            {/* Premium Header Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 animate-[fadeSlideUp_0.5s_ease-out]">
              {/* Balance Card */}
              <div className="bg-gradient-to-br from-sky-500/10 to-blue-500/10 border border-sky-500/20 rounded-3xl p-6 relative overflow-hidden backdrop-blur-md shadow-lg hover:border-sky-500/30 transition-all group">
                <div className="absolute top-0 right-0 w-24 h-24 bg-sky-500/5 rounded-full blur-2xl group-hover:bg-sky-500/10 transition-all duration-500" />
                <div className="flex justify-between items-start">
                  <div className="space-y-1">
                    <span className="text-[10px] text-zinc-500 font-extrabold uppercase tracking-wider block">เครดิตคงเหลือ</span>
                    <div className="flex items-baseline gap-1.5 pt-1">
                      <span className="text-3xl font-black text-sky-400 font-mono">
                        {session.user.balance?.toLocaleString() || 0}
                      </span>
                      <span className="text-xs font-bold text-sky-400">THB</span>
                    </div>
                  </div>
                  <div className="bg-sky-500/10 p-3 rounded-2xl text-sky-400">
                    <Wallet className="w-5 h-5" />
                  </div>
                </div>
                <div className="mt-4">
                  <Link href="/topup" className="inline-flex items-center gap-1 text-[11px] font-bold text-sky-400 hover:text-sky-300 transition-colors">
                    <span>เติมเงินเข้าเครดิต</span>
                    <span>→</span>
                  </Link>
                </div>
              </div>

              {/* Keys count Card */}
              <div className="bg-gradient-to-br from-purple-500/10 to-indigo-500/10 border border-purple-500/20 rounded-3xl p-6 relative overflow-hidden backdrop-blur-md shadow-lg hover:border-purple-500/30 transition-all group">
                <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/5 rounded-full blur-2xl group-hover:bg-purple-500/10 transition-all duration-500" />
                <div className="flex justify-between items-start">
                  <div className="space-y-1">
                    <span className="text-[10px] text-zinc-505 font-extrabold uppercase tracking-wider block">คีย์สินค้า & รางวัลสะสม</span>
                    <div className="flex items-baseline gap-1.5 pt-1">
                      <span className="text-3xl font-black text-purple-400 font-mono">
                        {parsedKeys.length}
                      </span>
                      <span className="text-xs font-bold text-purple-400">รายการ</span>
                    </div>
                  </div>
                  <div className="bg-purple-500/10 p-3 rounded-2xl text-purple-400">
                    <ShoppingBag className="w-5 h-5" />
                  </div>
                </div>
                <div className="mt-4">
                  <button onClick={() => setActiveTab('keys')} className="inline-flex items-center gap-1 text-[11px] font-bold text-purple-400 hover:text-purple-300 transition-colors cursor-pointer">
                    <span>ตรวจสอบรหัสคีย์ของคุณ</span>
                    <span>→</span>
                  </button>
                </div>
              </div>

              {/* Coupons Card */}
              <div className="bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-500/20 rounded-3xl p-6 relative overflow-hidden backdrop-blur-md shadow-lg hover:border-amber-500/30 transition-all group">
                <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-full blur-2xl group-hover:bg-amber-500/10 transition-all duration-500" />
                <div className="flex justify-between items-start">
                  <div className="space-y-1">
                    <span className="text-[10px] text-zinc-550 font-extrabold uppercase tracking-wider block">คูปองที่ใช้ได้</span>
                    <div className="flex items-baseline gap-1.5 pt-1">
                      <span className="text-3xl font-black text-amber-400 font-mono">
                        {coupons.filter(c => c.status === 'active').length}
                      </span>
                      <span className="text-xs font-bold text-amber-400">ใบ</span>
                    </div>
                  </div>
                  <div className="bg-amber-500/10 p-3 rounded-2xl text-amber-400">
                    <Ticket className="w-5 h-5" />
                  </div>
                </div>
                <div className="mt-4">
                  <button onClick={() => setActiveTab('coupons')} className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-400 hover:text-amber-300 transition-colors cursor-pointer">
                    <span>ดูคูปองสะสมทั้งหมด</span>
                    <span>→</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              
              {/* Left Column: VIP Card & Stats details */}
              <div className="space-y-6 lg:col-span-1">
                
                {/* VIP Card */}
                {userRank && (
                  <div className="bg-zinc-950/40 border border-white/5 rounded-3xl p-6 backdrop-blur-md space-y-6 shadow-xl relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-sky-500/5 rounded-full blur-3xl group-hover:bg-sky-500/10 transition-all duration-500" />
                    
                    <div className="flex items-center gap-3">
                      <div className="bg-gradient-to-r from-sky-400 to-blue-600 p-3.5 rounded-2xl text-sky-950">
                        <Award className="w-6 h-6" />
                      </div>
                      <div>
                        <h3 className="text-xs text-zinc-500 font-bold uppercase tracking-wider">ระดับสมาชิก VIP</h3>
                        <p className="text-lg font-black text-white">{userRank.name}</p>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="flex justify-between items-center text-xs text-zinc-400 border-b border-white/5 pb-2">
                        <span>ยอดสั่งซื้อสะสม:</span>
                        <span className="font-mono text-white font-bold">{currentSpent.toLocaleString()} THB</span>
                      </div>
                      <div className="flex justify-between items-center text-xs text-zinc-400">
                        <span>ส่วนลดสมาชิก VIP:</span>
                        <span className="font-mono text-purple-400 font-bold">{userRank.discountPercent}%</span>
                      </div>
                    </div>

                    {/* Progress to next rank */}
                    <div className="space-y-3 pt-4 border-t border-white/5">
                      <div className="flex justify-between items-center text-[10px] text-zinc-400 font-bold uppercase tracking-wider">
                        <span>ความคืบหน้าการเลื่อนยศ</span>
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
                          <>สะสมยอดช้อปเพิ่มอีก <strong className="text-sky-400 font-mono">{spentNeeded.toLocaleString()} THB</strong> เพื่อขยับเป็นยศ <strong className="text-purple-400">{nextRank.name}</strong></>
                        ) : (
                          <span className="text-amber-400 font-bold tracking-wider flex items-center justify-center gap-1">
                            <ShieldCheck className="w-3.5 h-3.5" />
                            ท่านได้รับสิทธิ์ส่วนลด VIP สูงสุดเรียบร้อยแล้ว
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                )}

              </div>

              {/* Right Column: Search, Filter, and categorized panels */}
              <div className="lg:col-span-2 space-y-6">
                
                {/* Search & Tabs Panel */}
                <div className="bg-zinc-950/45 border border-white/5 rounded-3xl p-5 backdrop-blur-md flex flex-col md:flex-row gap-4 items-center justify-between shadow-lg">
                  
                  {/* Tabs */}
                  <div className="flex bg-zinc-900 border border-white/5 p-1.5 rounded-2xl w-full md:w-auto shrink-0 overflow-x-auto scrollbar-none font-sans">
                    {[
                      { id: 'keys', label: 'คีย์สินค้า & รางวัล' },
                      { id: 'coupons', label: 'คูปองของฉัน' },
                      { id: 'billing', label: 'ประวัติการเงิน' },
                      { id: 'all', label: 'ประวัติบิลทั้งหมด' }
                    ].map(tab => (
                      <button
                        key={tab.id}
                        onClick={() => {
                          setActiveTab(tab.id);
                          setSearch(''); // ล้างช่องค้นหาเวลาสลับแท็บ
                        }}
                        className={`flex-1 md:flex-initial text-xs font-bold px-4 py-2.5 rounded-xl transition-all cursor-pointer whitespace-nowrap ${
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
                      placeholder={
                        activeTab === 'keys' ? "ค้นหาชื่อสินค้าหรือรหัสคีย์..." :
                        activeTab === 'coupons' ? "ค้นหารหัสโค้ดคูปอง..." : "ค้นหาประวัติชำระเงิน..."
                      }
                      className="w-full bg-zinc-900 border border-white/5 text-zinc-200 placeholder-zinc-500 text-xs px-4 py-2.5 pl-9 rounded-xl outline-none focus:border-sky-500/30 transition-all font-medium"
                    />
                    <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-3" />
                  </div>

                </div>

                {/* Tab content panels */}
                <div className="space-y-4">
                  
                  {/* 1. KEYS & PRIZES TAB */}
                  {activeTab === 'keys' && (
                    isLoading ? (
                      <div className="flex flex-col items-center justify-center py-24 gap-3 bg-zinc-950/20 border border-white/5 rounded-3xl backdrop-blur-md">
                        <div className="w-8 h-8 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" />
                        <p className="text-xs text-zinc-500">กำลังโหลดคลังคีย์สินค้าของคุณ...</p>
                      </div>
                    ) : error ? (
                      <div className="text-center py-20 text-xs text-red-400 bg-zinc-950/20 border border-white/5 rounded-3xl">
                        {error.message || 'เกิดข้อผิดพลาดในการดึงข้อมูลคลังคีย์'}
                      </div>
                    ) : filteredKeys.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-28 text-zinc-500 gap-3 bg-zinc-950/25 border border-white/5 rounded-3xl">
                        <ShoppingBag className="w-12 h-12 stroke-[1.2] text-zinc-600 animate-[wobble_1s_ease]" />
                        <p className="text-xs font-semibold">ไม่พบรหัสคีย์หรือของรางวัลสะสมในระบบ</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-[fadeIn_0.4s_ease-out]">
                        {filteredKeys.map((keyItem) => (
                          <div 
                            key={keyItem.id}
                            className="bg-gradient-to-br from-zinc-950/60 to-zinc-900/60 border border-white/5 hover:border-sky-500/20 p-5 rounded-3xl backdrop-blur-md relative overflow-hidden group shadow-lg transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_0_20px_rgba(56,189,248,0.05)]"
                          >
                            {/* Decorative background glow on hover */}
                            <div className="absolute inset-0 bg-gradient-to-r from-sky-500/0 via-sky-500/[0.01] to-purple-500/0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />

                            <div className="space-y-4">
                              <div className="flex justify-between items-start gap-2">
                                <div className="space-y-1">
                                  <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-wider border ${
                                    keyItem.source.startsWith('Gacha') 
                                      ? 'bg-amber-500/10 text-amber-400 border-amber-500/15'
                                      : 'bg-sky-500/10 text-sky-400 border-sky-500/15'
                                  }`}>
                                    <Tag className="w-2.5 h-2.5" />
                                    {keyItem.source}
                                  </span>
                                  <h4 className="text-sm font-bold text-white leading-normal pt-1.5 group-hover:text-sky-400 transition-colors">
                                    {keyItem.name}
                                  </h4>
                                </div>
                                <span className="text-[9px] text-zinc-500 font-semibold font-mono">
                                  {new Date(keyItem.date).toLocaleDateString('th-TH')}
                                </span>
                              </div>

                              {/* Key Code Display panel */}
                              <div className="bg-[#030712] border border-white/5 p-3.5 rounded-2xl flex items-center justify-between gap-3 shadow-inner group-hover:border-sky-500/15 transition-colors">
                                <span className="text-xs font-mono text-zinc-200 select-all truncate break-all pr-1">
                                  {keyItem.code}
                                </span>
                                <button
                                  onClick={() => handleCopy(keyItem.code, keyItem.id)}
                                  className="shrink-0 flex items-center justify-center p-2 bg-white/5 hover:bg-white/10 hover:text-white rounded-xl text-sky-400 transition-all active:scale-90 cursor-pointer"
                                  title="คัดลอกรหัสคีย์"
                                >
                                  {copiedId === keyItem.id ? (
                                    <Check className="w-3.5 h-3.5 text-emerald-400 animate-bounce" />
                                  ) : (
                                    <Copy className="w-3.5 h-3.5" />
                                  )}
                                </button>
                              </div>

                              <div className="flex justify-between items-center pt-2 border-t border-white/5 text-[10px] text-zinc-500">
                                <span className="font-mono">ค่าบริการ: {Math.abs(keyItem.price).toLocaleString()} THB</span>
                                <Link
                                  href={`/tickets?report=true&txId=${keyItem.txId}&product=${encodeURIComponent(keyItem.name)}&amount=${Math.abs(keyItem.price)}`}
                                  className="flex items-center gap-1 text-amber-500/80 hover:text-amber-400 font-bold transition-colors"
                                >
                                  <MessageSquare className="w-3.5 h-3.5" />
                                  <span>แจ้งปัญหาคีย์</span>
                                </Link>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )
                  )}

                  {/* 2. MY COUPONS TAB */}
                  {activeTab === 'coupons' && (
                    couponsLoading ? (
                      <div className="flex flex-col items-center justify-center py-24 gap-3 bg-zinc-950/20 border border-white/5 rounded-3xl backdrop-blur-md">
                        <div className="w-8 h-8 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" />
                        <p className="text-xs text-zinc-500">กำลังโหลดคูปองสะสม...</p>
                      </div>
                    ) : couponsError ? (
                      <div className="text-center py-20 text-xs text-red-400 bg-zinc-950/20 border border-white/5 rounded-3xl">
                        {couponsError.message || 'เกิดข้อผิดพลาดในการโหลดข้อมูลคูปอง'}
                      </div>
                    ) : filteredCoupons.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-28 text-zinc-500 gap-3 bg-zinc-950/25 border border-white/5 rounded-3xl">
                        <Ticket className="w-12 h-12 stroke-[1.2] text-zinc-600" />
                        <p className="text-xs font-semibold">คุณยังไม่มีคูปองส่วนลดสะสมที่พร้อมใช้งานในขณะนี้</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-[fadeIn_0.4s_ease-out]">
                        {filteredCoupons.map((cp) => {
                          const isUsed = cp.status === 'used';
                          const isExpired = cp.status === 'expired';
                          const isInactive = cp.status === 'inactive';
                          
                          return (
                            <div
                              key={cp.id}
                              className={`relative overflow-hidden bg-gradient-to-tr from-zinc-950/60 to-zinc-900/60 border rounded-3xl p-5 backdrop-blur-md flex flex-col justify-between gap-4 transition-all hover:border-sky-500/20 ${
                                isUsed ? 'opacity-40 border-white/5 shadow-none' : isExpired || isInactive ? 'border-red-500/10' : 'border-sky-500/20 shadow-md'
                              }`}
                            >
                              {/* Dotted Ticket Separation Line */}
                              <div className="absolute left-1/4 top-0 bottom-0 border-r border-dashed border-white/5 pointer-events-none" />

                              {/* Ticket cutout decoration left/right */}
                              <div className="absolute top-1/2 -left-2.5 w-5 h-5 bg-[#02060d] border border-white/5 rounded-full -translate-y-1/2 z-10" />
                              <div className="absolute top-1/2 -right-2.5 w-5 h-5 bg-[#02060d] border border-white/5 rounded-full -translate-y-1/2 z-10" />

                              <div className="space-y-3 relative z-10">
                                <div className="flex justify-between items-start">
                                  <div className="space-y-0.5">
                                    <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider block">คูปองรหัส</span>
                                    <h4 className="text-base font-black text-sky-400 tracking-wider font-mono">
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
                                    {isUsed ? 'ใช้ไปแล้ว' : isExpired ? 'หมดอายุ' : isInactive ? 'ปิดบริการ' : 'คูปองพร้อมใช้'}
                                  </span>
                                </div>

                                <div className="space-y-1 pt-1">
                                  <div className="flex items-baseline gap-0.5 text-2xl font-black text-white font-mono leading-none">
                                    {cp.discount.toLocaleString()}
                                    <span className="text-xs font-bold text-zinc-400 font-sans ml-0.5">
                                      {cp.type === 'percentage' ? '%' : 'THB'}
                                    </span>
                                  </div>
                                  <p className="text-[11px] text-zinc-400 leading-normal">
                                    {cp.type === 'percentage'
                                      ? `ลดพิเศษ ${cp.discount}% ${cp.maxDiscount ? `(สูงสุด ${cp.maxDiscount} บาท)` : ''}`
                                      : `ส่วนลดมูลค่า ${cp.discount} บาท`
                                    } · ยอดซื้อขั้นต่ำ {cp.minPurchase} บาท
                                  </p>
                                </div>
                              </div>

                              <div className="border-t border-white/5 pt-3 flex justify-between items-center text-[10px] text-zinc-500 relative z-10">
                                <span className="font-mono">
                                  {cp.expiresAt ? `หมดอายุ: ${new Date(cp.expiresAt).toLocaleDateString('th-TH')}` : 'ถาวร (ไม่มีวันหมดอายุ)'}
                                </span>
                                {!isUsed && !isExpired && !isInactive && (
                                  <button
                                    onClick={() => handleCopy(cp.code, cp.id)}
                                    className="flex items-center gap-1.5 text-[10px] font-bold text-sky-400 hover:text-sky-300 bg-sky-950/20 hover:bg-sky-950/40 border border-sky-500/10 hover:border-sky-500/30 px-3 py-1.5 rounded-xl transition-all cursor-pointer"
                                  >
                                    {copiedId === cp.id ? (
                                      <>
                                        <Check className="w-3 h-3 text-emerald-400" />
                                        <span className="text-emerald-400">คัดลอกแล้ว</span>
                                      </>
                                    ) : (
                                      <>
                                        <Copy className="w-3 h-3" />
                                        <span>คัดลอกโค้ด</span>
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
                  )}

                  {/* 3. BILLING INVOICES TAB */}
                  {(activeTab === 'billing' || activeTab === 'all') && (
                    isLoading ? (
                      <div className="flex flex-col items-center justify-center py-24 gap-3 bg-zinc-950/20 border border-white/5 rounded-3xl backdrop-blur-md">
                        <div className="w-8 h-8 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" />
                        <p className="text-xs text-zinc-500">กำลังโหลดรายการบิลธุรกรรม...</p>
                      </div>
                    ) : error ? (
                      <div className="text-center py-20 text-xs text-red-400 bg-zinc-950/20 border border-white/5 rounded-3xl">
                        {error.message || 'เกิดข้อผิดพลาดในการโหลดรายการธุรกรรม'}
                      </div>
                    ) : filteredBilling.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-28 text-zinc-500 gap-3 bg-zinc-950/25 border border-white/5 rounded-3xl">
                        <Clock className="w-12 h-12 stroke-[1.2] text-zinc-600" />
                        <p className="text-xs font-semibold">ไม่พบข้อมูลประวัติชำระเงินที่ตรงกับการค้นหา</p>
                      </div>
                    ) : (
                      <div className="space-y-4 animate-[fadeIn_0.4s_ease-out]">
                        {filteredBilling.map((tx) => {
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
                                    className={`px-2.5 py-1 rounded-lg text-[9px] font-bold uppercase tracking-wider flex items-center gap-1.5 ${
                                      isPurchase
                                        ? 'bg-red-500/10 text-red-400 border border-red-500/10'
                                        : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/10'
                                    }`}
                                  >
                                    {isPurchase ? (
                                      <>
                                        <ShoppingBag className="w-3 h-3" />
                                        ชำระเงิน / สปินกิ๊ฟท์
                                      </>
                                    ) : (
                                      <>
                                        <Wallet className="w-3 h-3" />
                                        เติมเงินบัญชี
                                      </>
                                    )}
                                  </span>
                                  <span className="text-[10px] text-zinc-500 font-mono font-medium">{dateStr}</span>
                                </div>

                                <div className="text-xs text-zinc-300 font-medium whitespace-pre-line leading-relaxed font-mono">
                                  {tx.description}
                                </div>

                              </div>

                              <div className="flex flex-row md:flex-col items-center md:items-end justify-between gap-3 border-t md:border-t-0 pt-3 md:pt-0 border-white/5">
                                
                                {/* Cost/Amount */}
                                <div
                                  className={`text-base font-black font-mono ${
                                    isPurchase ? 'text-red-400' : 'text-emerald-400'
                                  }`}
                                >
                                  {isPurchase ? '' : '+'}
                                  {tx.amount.toLocaleString()} THB
                                </div>

                                {/* Copy and Action box */}
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => handleCopy(tx.description, tx._id)}
                                    className="flex items-center justify-center p-2 bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white rounded-xl transition-all cursor-pointer active:scale-95 border border-white/5"
                                    title="คัดลอกคำอธิบายรายการ"
                                  >
                                    {copiedId === tx._id ? (
                                      <Check className="w-4 h-4 text-emerald-400" />
                                    ) : (
                                      <Copy className="w-4 h-4" />
                                    )}
                                  </button>
                                  <Link
                                    href={(() => {
                                      const lines = (tx.description || '').split('\n');
                                      const firstLine = lines[0] || '';
                                      let productName = '';

                                      if (firstLine.startsWith('ซื้อสินค้า:')) {
                                        productName = firstLine.replace(/^ซื้อสินค้า:\s*/, '').replace(/\s*x\d+.*$/, '').trim();
                                      } else if (firstLine.startsWith('ชำระเงินตะกร้าสินค้า')) {
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

                              </div>

                            </div>
                          );
                        })}
                      </div>
                    )
                  )}

                </div>

              </div>

            </div>

          </div>
        )}

      </main>

      <Footer />
    </div>
  );
}
