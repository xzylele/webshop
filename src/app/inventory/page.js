'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
  ShieldCheck,
  Landmark,
  Coins,
  Sparkles,
  Loader2,
  Gift
} from 'lucide-react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import CanvasBackground from '../components/CanvasBackground';
import { getUserRank, RANKS } from '@/lib/ranks';
import Link from 'next/link';

// ─── ฟังก์ชันคัดแยกคีย์สินค้า/โค้ดรางวัลจากประวัติเงินสด ───
function parseKeysFromTransactions(transactionsList, refundedTxIds = new Set()) {
  if (!transactionsList || !Array.isArray(transactionsList)) return [];
  const keys = [];

  transactionsList.forEach(tx => {
    if (tx.type !== 'purchase' || tx.status !== 'completed') return;

    const desc = tx.description || '';
    const lines = desc.split('\n').map(l => l.trim());
    const firstLine = lines[0] || '';
    const isRefunded = refundedTxIds.has(tx.id);

    // 1. ตรวจจับรางวัลจากการหมุนวงล้อ Gacha
    if (firstLine.startsWith('[สุ่มวงล้อ Gacha:')) {
      const match = firstLine.match(/\[สุ่มวงล้อ Gacha:\s*(.+?)\]\s*สุ่มได้:\s*(.+)/);
      if (match) {
        const tierName = match[1];
        const prizeName = match[2];

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
              isRefunded: isRefunded,
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
              isRefunded: isRefunded,
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
          isRefunded: isRefunded,
        });
      });
    }
  });

  return keys;
}

// ─── ฟังก์ชันคัดแยกคีย์จากการหมุน Point Gacha ───
function parsePointGachaKeysFromTransactions(transactionsList) {
  if (!transactionsList || !Array.isArray(transactionsList)) return [];
  const keys = [];

  transactionsList.forEach(tx => {
    if (tx.type !== 'purchase' || tx.status !== 'completed') return;

    const desc = tx.description || '';
    const lines = desc.split('\n').map(l => l.trim());
    const firstLine = lines[0] || '';

    if (firstLine.startsWith('[แลกพอยท์สุ่ม Point Gacha]')) {
      const match = firstLine.match(/\[แลกพอยท์สุ่ม Point Gacha\] ผลลัพธ์:\s*(.+)/);
      if (match) {
        const prizeName = match[1];
        if (prizeName !== 'เกลือ' && !prizeName.includes('เกลือ')) {
          const codes = lines.slice(1).filter(l => l.length > 0);
          codes.forEach((code, idx) => {
            keys.push({
              id: `pointgacha-${tx.id}-${idx}`,
              txId: tx.id,
              name: prizeName,
              source: 'Point Gacha (สุ่มใช้พอยท์)',
              code: code,
              date: tx.createdAt,
              price: 0,
              isRefunded: false,
            });
          });
        }
      }
    }
  });

  return keys;
}

// ─── ฟังก์ชันคัดแยกคีย์จากการแลกของรางวัล Point Shop Direct ───
function parseKeysFromPointTransactions(pointTransactionsList) {
  if (!pointTransactionsList || !Array.isArray(pointTransactionsList)) return [];
  const keys = [];

  pointTransactionsList.forEach(tx => {
    if (tx.type !== 'redeem') return;

    const desc = tx.description || '';
    if (desc.includes('| รหัสโค้ด:')) {
      const parts = desc.split('| รหัสโค้ด:');
      const prefix = parts[0] || '';
      const codePart = (parts[1] || '').trim();

      const nameMatch = prefix.match(/แลกของรางวัล:\s*(.+?)\s*\(/);
      const prizeName = nameMatch ? nameMatch[1].trim() : 'ของรางวัลพอยท์ช็อป';

      if (codePart) {
        keys.push({
          id: `pointredeem-${tx.id}`,
          txId: tx.id,
          name: prizeName,
          source: 'แลกพอยท์ช็อป',
          code: codePart,
          date: tx.created_at || tx.createdAt || tx.created_at,
          price: 0,
          isRefunded: false,
        });
      }
    }
  });

  return keys;
}

export default function InventoryPage() {
  const { data: session, status, update: updateSession } = useSession();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('keys'); // keys | coupons | billing | point-shop | quests
  const [copiedId, setCopiedId] = useState(null);

  // Point Shop & Point Gacha States
  const [pointItemCategoryTab, setPointItemCategoryTab] = useState('all'); // all | credit | coupon | code
  const [claimingQuest, setClaimingQuest] = useState(null);
  const [redeemingItem, setRedeemingItem] = useState(null);
  const [redeemSuccess, setRedeemSuccess] = useState(null);
  const [spinLoading, setSpinLoading] = useState(false);
  const [spinResult, setSpinResult] = useState(null);
  const [spinError, setSpinError] = useState('');

  // 1. ดึงประวัติธุรกรรมวอลเล็ต
  const { data: transactions = [], isLoading, error, refetch } = useQuery({
    queryKey: ['transactions'],
    queryFn: async () => {
      const res = await fetch('/api/transactions');
      if (!res.ok) throw new Error('เกิดข้อผิดพลาดในการโหลดประวัติ');
      return res.json();
    },
    enabled: !!session,
  });

  // 2. ดึงข้อมูลคูปองสะสมของตนเอง
  const { data: coupons = [], isLoading: couponsLoading, error: couponsError, refetch: refetchCoupons } = useQuery({
    queryKey: ['my-coupons'],
    queryFn: async () => {
      const res = await fetch('/api/coupons/my-coupons');
      if (!res.ok) throw new Error('เกิดข้อผิดพลาดในการโหลดคูปองสะสม');
      return res.json();
    },
    enabled: !!session,
  });

  // 3. ดึงข้อมูลตั๋วช่วยเหลือสะสมเพื่อนำมาคำนวณสถานะการคืนเงิน
  const { data: tickets = [] } = useQuery({
    queryKey: ['user-tickets-for-inventory'],
    queryFn: async () => {
      const res = await fetch('/api/support/tickets');
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!session,
  });

  // 4. ดึงของรางวัลในร้านค้าแต้มสะสม
  const { data: shopItems = [], isLoading: itemsLoading } = useQuery({
    queryKey: ['point-shop-items'],
    queryFn: async () => {
      const res = await fetch('/api/point-shop/items');
      if (!res.ok) throw new Error('Failed to load point shop items');
      return res.json();
    },
    enabled: !!session
  });

  // 5. ดึงข้อมูลภารกิจประจำวัน และประวัติแต้มสะสม
  const { data: questsData = { quests: [], history: [] }, isLoading: questsLoading } = useQuery({
    queryKey: ['daily-quests'],
    queryFn: async () => {
      const res = await fetch('/api/point-shop/quests');
      if (!res.ok) throw new Error('Failed to load quests data');
      return res.json();
    },
    enabled: !!session
  });

  // 6. ดึงข้อมูลระบบกาชาเพื่อหา ID ตู้ Point Gacha
  const { data: gachaData = { tiers: [] } } = useQuery({
    queryKey: ['gacha-tiers'],
    queryFn: async () => {
      const res = await fetch('/api/gacha/spin');
      if (!res.ok) throw new Error('Failed to load gacha tiers');
      return res.json();
    },
    enabled: !!session
  });

  const pointGachaTier = gachaData.tiers?.find(t => t.slug === 'point');

  // Mutation: การแลกของรางวัล
  const redeemMutation = useMutation({
    mutationFn: async (itemId) => {
      const res = await fetch('/api/point-shop/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'เกิดข้อผิดพลาดในการแลกของรางวัล');
      return data;
    },
    onSuccess: (data) => {
      setRedeemSuccess(data);
      updateSession({ refresh: true });
      queryClient.invalidateQueries({ queryKey: ['point-shop-items'] });
      queryClient.invalidateQueries({ queryKey: ['daily-quests'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['my-coupons'] });
      setTimeout(() => {
        setRedeemSuccess(null);
      }, 8000);
    },
    onError: (err) => {
      alert(err.message);
    },
    onSettled: () => {
      setRedeemingItem(null);
    }
  });

  // Mutation: ภารกิจ (เช็คอิน & เคลมแต้ม)
  const questMutation = useMutation({
    mutationFn: async (payload) => {
      const res = await fetch('/api/point-shop/quests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'เกิดข้อผิดพลาดในการทำรายการภารกิจ');
      return data;
    },
    onSuccess: (data) => {
      alert(data.message);
      updateSession({ refresh: true });
      queryClient.invalidateQueries({ queryKey: ['daily-quests'] });
    },
    onError: (err) => {
      alert(err.message);
    },
    onSettled: () => {
      setClaimingQuest(null);
    }
  });

  // เช็คแท็บนำทางจาก URL parameter
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get('tab');
    if (tab && ['keys', 'coupons', 'billing', 'point-shop', 'quests'].includes(tab)) {
      setActiveTab(tab);
    }
  }, []);

  const handleCopy = (text, id) => {
    // เอาข้อมูลส่วนตัวข้างหลังออก (ถ้ามีเครื่องหมาย # สำหรับคูปองแลกแต้ม)
    const cleanText = text.split('#')[0];
    navigator.clipboard.writeText(cleanText);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleRefresh = () => {
    refetch();
    refetchCoupons();
    queryClient.invalidateQueries({ queryKey: ['point-shop-items'] });
    queryClient.invalidateQueries({ queryKey: ['daily-quests'] });
    updateSession({ refresh: true });
  };

  const handleCheckin = () => {
    if (!session) return alert('กรุณาเข้าสู่ระบบก่อนทำรายการ');
    setClaimingQuest('checkin');
    questMutation.mutate({ action: 'checkin' });
  };

  const handleClaimQuest = (questKey) => {
    if (!session) return alert('กรุณาเข้าสู่ระบบก่อนทำรายการ');
    setClaimingQuest(questKey);
    questMutation.mutate({ action: 'claim', questType: questKey });
  };

  const handleRedeem = (item) => {
    if (!session) return alert('กรุณาเข้าสู่ระบบก่อนทำการแลกพอยท์');
    if (confirm(`คุณต้องการใช้ ${item.point_cost} แต้ม เพื่อแลก "${item.name}" ใช่หรือไม่?`)) {
      setRedeemingItem(item.id);
      redeemMutation.mutate(item.id);
    }
  };

  const handleSpinPointGacha = async () => {
    if (!session) return alert('กรุณาเข้าสู่ระบบก่อนทำการสุ่มกาชา');
    if (!pointGachaTier) return alert('ตู้ Point Gacha ปิดใช้งานชั่วคราว');

    setSpinError('');
    setSpinResult(null);
    setSpinLoading(true);

    try {
      const res = await fetch('/api/gacha/spin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tierId: pointGachaTier.id })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'เกิดข้อผิดพลาดในการสุ่มกาชา');
      }

      setSpinResult(data);
      updateSession({ refresh: true });
      queryClient.invalidateQueries({ queryKey: ['daily-quests'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] }); // ดึงให้รายการคีย์หน้าคลังขึ้นใหม่
    } catch (err) {
      setSpinError(err.message);
    } finally {
      setSpinLoading(false);
    }
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

  // ─── ประมวลผลหา Transaction ID ที่ทำการคืนเงินสำเร็จแล้ว ───
  const refundedTxIds = new Set();
  tickets.forEach(ticket => {
    const hasRefundTx = transactions.some(tx => 
      (tx.type === 'refund' || (tx.type === 'topup' && tx.description?.includes('คืนเงินตั๋วช่วยเหลือ'))) &&
      tx.description?.includes(`#${ticket._id.substring(0, 8)}`)
    );
    if (hasRefundTx) {
      const txIdMatch = ticket.description?.match(/Transaction ID:\s*([a-f0-9\-]{36})/i);
      if (txIdMatch) {
        refundedTxIds.add(txIdMatch[1]);
      }
    }
  });

  // แยกคีย์สินค้าและของรางวัลจากธุรกรรมทั้งหมด
  const parsedNormalKeys = parseKeysFromTransactions(transactions, refundedTxIds);
  const parsedPointGachaKeys = parsePointGachaKeysFromTransactions(transactions);
  const parsedRedeemKeys = parseKeysFromPointTransactions(questsData.history || []);

  const parsedKeys = [
    ...parsedNormalKeys,
    ...parsedPointGachaKeys,
    ...parsedRedeemKeys
  ].sort((a, b) => new Date(b.date) - new Date(a.date));

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
    if (activeTab === 'billing') {
      if (!search.trim()) return true;
      const s = search.toLowerCase();
      return tx.description.toLowerCase().includes(s) || tx.type.toLowerCase().includes(s);
    }
    return true;
  });

  const filteredShopItems = shopItems.filter(item => {
    if (pointItemCategoryTab === 'all') return true;
    return item.reward_type === pointItemCategoryTab;
  });

  return (
    <div className="relative min-h-screen bg-[#02060d] text-white flex flex-col font-sans">
      <CanvasBackground />
      <Navbar />

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-8 relative z-10 space-y-8 animate-[fadeIn_0.5s_ease-out]">

        {/* Page Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-white/5 pb-6">
          <div>
            <h1 className="text-3xl font-black bg-gradient-to-r from-sky-400 via-blue-500 to-purple-500 bg-clip-text text-transparent leading-normal font-sans">
              ศูนย์สมาชิก & ร้านค้าสะสมแต้ม (Member Hub & Point Center)
            </h1>
            <p className="text-xs text-zinc-400">
              จัดการคลังคีย์ส่วนตัว แลกรับของรางวัลพอยท์ช็อป ทำภารกิจประจำวัน และตรวจสอบบิลธุรกรรมของท่านได้ที่นี่
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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 animate-[fadeSlideUp_0.5s_ease-out]">
              
              {/* Card 1: Wallet Balance */}
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

              {/* Card 2: Point Balance */}
              <div className="bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-500/20 rounded-3xl p-6 relative overflow-hidden backdrop-blur-md shadow-lg hover:border-amber-500/30 transition-all group">
                <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-full blur-2xl group-hover:bg-amber-500/10 transition-all duration-500" />
                <div className="flex justify-between items-start">
                  <div className="space-y-1">
                    <span className="text-[10px] text-zinc-500 font-extrabold uppercase tracking-wider block">แต้มสะสมพอยท์</span>
                    <div className="flex items-baseline gap-1.5 pt-1">
                      <span className="text-3xl font-black text-amber-400 font-mono">
                        {session.user.points?.toLocaleString() || 0}
                      </span>
                      <span className="text-xs font-bold text-amber-400 font-sans">Points</span>
                    </div>
                  </div>
                  <div className="bg-amber-500/10 p-3 rounded-2xl text-amber-400">
                    <Coins className="w-5 h-5" />
                  </div>
                </div>
                <div className="mt-4">
                  <button onClick={() => setActiveTab('point-shop')} className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-400 hover:text-amber-300 transition-colors cursor-pointer bg-transparent border-0 outline-none">
                    <span>ไปร้านค้าแลกพอยท์</span>
                    <span>→</span>
                  </button>
                </div>
              </div>

              {/* Card 3: Keys count */}
              <div className="bg-gradient-to-br from-purple-500/10 to-indigo-500/10 border border-purple-500/20 rounded-3xl p-6 relative overflow-hidden backdrop-blur-md shadow-lg hover:border-purple-500/30 transition-all group">
                <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/5 rounded-full blur-2xl group-hover:bg-purple-500/10 transition-all duration-500" />
                <div className="flex justify-between items-start">
                  <div className="space-y-1">
                    <span className="text-[10px] text-zinc-500 font-extrabold uppercase tracking-wider block">คีย์สินค้า & รางวัลสะสม</span>
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
                  <button onClick={() => setActiveTab('keys')} className="inline-flex items-center gap-1 text-[11px] font-bold text-purple-400 hover:text-purple-300 transition-colors cursor-pointer bg-transparent border-0 outline-none">
                    <span>ตรวจสอบรหัสคีย์ของคุณ</span>
                    <span>→</span>
                  </button>
                </div>
              </div>

              {/* Card 4: Coupons count */}
              <div className="bg-gradient-to-br from-teal-500/10 to-emerald-500/10 border border-teal-500/20 rounded-3xl p-6 relative overflow-hidden backdrop-blur-md shadow-lg hover:border-teal-500/30 transition-all group">
                <div className="absolute top-0 right-0 w-24 h-24 bg-teal-500/5 rounded-full blur-2xl group-hover:bg-teal-500/10 transition-all duration-500" />
                <div className="flex justify-between items-start">
                  <div className="space-y-1">
                    <span className="text-[10px] text-zinc-500 font-extrabold uppercase tracking-wider block">คูปองที่ใช้ได้</span>
                    <div className="flex items-baseline gap-1.5 pt-1">
                      <span className="text-3xl font-black text-teal-400 font-mono">
                        {coupons.filter(c => c.status === 'active').length}
                      </span>
                      <span className="text-xs font-bold text-teal-400">ใบ</span>
                    </div>
                  </div>
                  <div className="bg-teal-500/10 p-3 rounded-2xl text-teal-400">
                    <Ticket className="w-5 h-5" />
                  </div>
                </div>
                <div className="mt-4">
                  <button onClick={() => setActiveTab('coupons')} className="inline-flex items-center gap-1 text-[11px] font-bold text-teal-400 hover:text-teal-300 transition-colors cursor-pointer bg-transparent border-0 outline-none">
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
                      { id: 'keys', label: 'คีย์ & ของรางวัล' },
                      { id: 'coupons', label: 'คูปองของฉัน' },
                      { id: 'billing', label: 'ประวัติการเงิน' },
                      { id: 'point-shop', label: 'ร้านค้าแลกพอยท์ 🪙' },
                      { id: 'quests', label: 'ภารกิจประจำวัน 🏆' },
                    ].map(tab => (
                      <button
                        key={tab.id}
                        onClick={() => {
                          setActiveTab(tab.id);
                          setSearch('');
                        }}
                        className={`flex-1 md:flex-initial text-xs font-bold px-4 py-2.5 rounded-xl transition-all cursor-pointer whitespace-nowrap ${activeTab === tab.id
                            ? 'bg-sky-500 text-sky-950 shadow-lg'
                            : 'text-zinc-400 hover:text-white'
                          }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  {/* Search Bar (เฉพาะแท็บ Keys, Coupons, Invoices) */}
                  {['keys', 'coupons', 'billing'].includes(activeTab) && (
                    <div className="relative w-full md:w-56">
                      <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder={
                          activeTab === 'keys' ? "ค้นหาชื่อสินค้าหรือคีย์..." :
                            activeTab === 'coupons' ? "ค้นหารหัสโค้ดคูปอง..." : "ค้นหาประวัติชำระเงิน..."
                        }
                        className="w-full bg-zinc-900 border border-white/5 text-zinc-200 placeholder-zinc-500 text-xs px-4 py-2.5 pl-9 rounded-xl outline-none focus:border-sky-500/30 transition-all font-medium"
                      />
                      <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-3" />
                    </div>
                  )}

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
                            className={`bg-gradient-to-br from-zinc-950/60 to-zinc-900/60 border p-5 rounded-3xl backdrop-blur-md relative overflow-hidden group shadow-lg transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_0_20px_rgba(56,189,248,0.05)] ${
                              keyItem.isRefunded 
                                ? 'opacity-60 border-red-500/10 hover:border-red-500/20' 
                                : 'border-white/5 hover:border-sky-500/20'
                            }`}
                          >
                            <div className="absolute inset-0 bg-gradient-to-r from-sky-500/0 via-sky-500/[0.01] to-purple-500/0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />

                            <div className="space-y-4">
                              <div className="flex justify-between items-start gap-2">
                                <div className="space-y-1">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-wider border ${
                                      keyItem.source.includes('Gacha')
                                        ? 'bg-amber-500/10 text-amber-400 border-amber-500/15'
                                        : keyItem.source.includes('พอยท์ช็อป')
                                          ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/15'
                                          : 'bg-sky-500/10 text-sky-400 border-sky-500/15'
                                      }`}>
                                      <Tag className="w-2.5 h-2.5" />
                                      {keyItem.source}
                                    </span>
                                    {keyItem.isRefunded && (
                                      <span className="px-2 py-0.5 rounded-lg text-[9px] font-black bg-red-500/15 border border-red-500/20 text-red-400">
                                        คืนเงินสำเร็จ
                                      </span>
                                    )}
                                  </div>
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
                                  {keyItem.code.split('#')[0]}
                                </span>
                                <button
                                  onClick={() => handleCopy(keyItem.code, keyItem.id)}
                                  className="shrink-0 flex items-center justify-center p-2 bg-white/5 hover:bg-white/10 hover:text-white rounded-xl text-sky-400 transition-all active:scale-90 cursor-pointer border-0 outline-none"
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
                                <span className="font-mono">
                                  {keyItem.price > 0 ? `ค่าบริการ: ${Math.abs(keyItem.price).toLocaleString()} THB` : 'แลกด้วยแต้มสะสม'}
                                </span>
                                {keyItem.isRefunded ? (
                                  <span className="flex items-center gap-1 text-red-400 font-bold font-sans">
                                    🔒 คืนเงินแล้ว
                                  </span>
                                ) : keyItem.price > 0 ? (
                                  <Link
                                    href={`/tickets?report=true&txId=${keyItem.txId}&product=${encodeURIComponent(keyItem.name)}&amount=${Math.abs(keyItem.price)}`}
                                    className="flex items-center gap-1 text-amber-500/80 hover:text-amber-400 font-bold transition-colors"
                                  >
                                    <MessageSquare className="w-3.5 h-3.5" />
                                    <span>แจ้งปัญหาคีย์</span>
                                  </Link>
                                ) : (
                                  <span className="text-zinc-600 font-bold">พอยท์ช็อปการันตี ✅</span>
                                )}
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
                              className={`relative overflow-hidden bg-gradient-to-tr from-zinc-950/60 to-zinc-900/60 border rounded-3xl p-5 backdrop-blur-md flex flex-col justify-between gap-4 transition-all hover:border-sky-500/20 ${isUsed ? 'opacity-40 border-white/5 shadow-none' : isExpired || isInactive ? 'border-red-500/10' : 'border-sky-500/20 shadow-md'
                                }`}
                            >
                              <div className="absolute left-1/4 top-0 bottom-0 border-r border-dashed border-white/5 pointer-events-none" />

                              <div className="absolute top-1/2 -left-2.5 w-5 h-5 bg-[#02060d] border border-white/5 rounded-full -translate-y-1/2 z-10" />
                              <div className="absolute top-1/2 -right-2.5 w-5 h-5 bg-[#02060d] border border-white/5 rounded-full -translate-y-1/2 z-10" />

                              <div className="space-y-3 relative z-10">
                                <div className="flex justify-between items-start">
                                  <div className="space-y-0.5">
                                    <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider block">คูปองรหัส</span>
                                    <h4 className="text-base font-black text-sky-400 tracking-wider font-mono">
                                      {cp.code.split('#')[0]}
                                    </h4>
                                  </div>
                                  <span
                                    className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border ${isUsed
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
                                    className="flex items-center gap-1.5 text-[10px] font-bold text-sky-400 hover:text-sky-300 bg-sky-950/20 hover:bg-sky-950/40 border border-sky-500/10 hover:border-sky-500/30 px-3 py-1.5 rounded-xl transition-all cursor-pointer outline-none"
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
                  {activeTab === 'billing' && (
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
                          const isRefund = tx.type === 'refund' || (tx.type === 'topup' && tx.description?.includes('คืนเงินตั๋วช่วยเหลือ'));
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
                                      isRefund
                                        ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                        : isPurchase
                                          ? 'bg-red-500/10 text-red-400 border border-red-500/10'
                                          : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/10'
                                    }`}
                                  >
                                    {isRefund ? (
                                      <>
                                        <Landmark className="w-3 h-3" />
                                        คืนเงินเครดิต / รีฟัน
                                      </>
                                    ) : isPurchase ? (
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
                                <div
                                  className={`text-base font-black font-mono ${
                                    isRefund
                                      ? 'text-amber-400'
                                      : isPurchase
                                        ? 'text-red-400'
                                        : 'text-emerald-400'
                                  }`}
                                >
                                  {isRefund ? '+' : isPurchase ? '' : '+'}
                                  {tx.amount.toLocaleString()} THB
                                </div>

                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => handleCopy(tx.description, tx._id)}
                                    className="flex items-center justify-center p-2 bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white rounded-xl transition-all cursor-pointer active:scale-95 border border-white/5 outline-none"
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

                  {/* 4. POINT SHOP TAB (ร้านค้าและตู้ Point Gacha) */}
                  {activeTab === 'point-shop' && (
                    <div className="space-y-8 animate-[fadeIn_0.4s_ease-out]">
                      
                      {/* Point Gacha Section */}
                      <div className="bg-gradient-to-br from-amber-500/5 via-zinc-950/45 to-orange-500/5 border border-white/5 rounded-3xl p-6 backdrop-blur-md relative overflow-hidden shadow-xl">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-3xl -z-10" />
                        
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-white/5 mb-6">
                          <div>
                            <h2 className="text-base font-black text-white flex items-center gap-2 font-sans">
                              <Sparkles className="w-5 h-5 text-amber-400" />
                              <span>ตู้สุ่มลุ้นโชค Point Gacha (Point Minigame)</span>
                            </h2>
                            <p className="text-[11px] text-zinc-400 mt-0.5">แลกสิทธิ์หมุนสุ่มรางวัล เครดิตฟรี คูปองพิเศษ หรือเกลือสะสมโชค ครั้งละ 15 พอยท์!</p>
                          </div>
                          <span className="bg-amber-500/10 text-amber-400 border border-amber-500/20 text-xs font-bold px-3 py-1 rounded-full shrink-0">
                            ราคา: 15 พอยท์ 🪙
                          </span>
                        </div>

                        <div className="flex flex-col md:flex-row items-center gap-8 justify-center py-2">
                          {/* Visual Gacha */}
                          <div className="relative w-36 h-36 flex items-center justify-center">
                            <div className={`absolute inset-0 bg-gradient-to-tr from-amber-500 to-yellow-400 rounded-3xl opacity-15 blur-xl ${spinLoading ? 'animate-ping' : ''}`} />
                            
                            <div className={`w-32 h-32 bg-zinc-900 border-2 border-amber-500/20 rounded-3xl flex flex-col items-center justify-center relative z-10 transition-all ${spinLoading ? 'animate-bounce border-amber-500 scale-95 shadow-[0_0_25px_rgba(245,158,11,0.15)]' : 'hover:scale-[1.02] hover:border-amber-500/40'}`}>
                              {spinLoading ? (
                                <Loader2 className="w-12 h-12 text-amber-500 animate-spin" />
                              ) : (
                                <div className="text-center space-y-1.5">
                                  <span className="text-3xl">🎰</span>
                                  <span className="text-[9px] text-zinc-500 block font-bold tracking-wider uppercase">กดปุ่มสุ่ม</span>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Spin Actions */}
                          <div className="flex-1 space-y-4 max-w-sm w-full text-center md:text-left">
                            {spinResult ? (
                              <div className="bg-emerald-500/10 border border-emerald-500/25 p-4 rounded-2xl space-y-1 animate-[zoomIn_0.2s_ease-out] text-left">
                                <span className="text-[10px] text-emerald-400 font-extrabold uppercase tracking-wider block">🎉 ผลลัพธ์จากการสุ่ม:</span>
                                <h3 className="text-sm font-bold text-white">{spinResult.prizeName}</h3>
                                {spinResult.type === 'coupon' && (
                                  <div className="pt-1 bg-transparent">
                                    <span className="text-[9px] text-zinc-500 block">คูปองนี้แอดเข้าเมนู "คูปองของฉัน" ให้แล้ว:</span>
                                    <span className="text-[11px] font-mono font-bold bg-zinc-950 px-2 py-0.5 rounded border border-white/5 text-amber-400 inline-block select-all">{spinResult.wonValue.split('#')[0]}</span>
                                  </div>
                                )}
                                {spinResult.type === 'topup' && (
                                  <div className="pt-1">
                                    <span className="text-[9px] text-zinc-500 block">โค้ดบัตรเติมเงิน (เข้าคลังประวัติคีย์แล้ว):</span>
                                    <span className="text-[11px] font-mono font-bold bg-zinc-950 px-2 py-0.5 rounded border border-white/5 text-sky-400 inline-block select-all">{spinResult.wonValue}</span>
                                  </div>
                                )}
                              </div>
                            ) : spinError ? (
                              <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-2xl text-xs text-red-400 flex items-center gap-2">
                                <AlertCircle className="w-5 h-5 shrink-0" />
                                <span>{spinError}</span>
                              </div>
                            ) : (
                              <div className="bg-zinc-900/40 border border-white/5 p-4 rounded-2xl text-[11px] text-zinc-400 leading-relaxed text-left">
                                <span className="font-bold text-zinc-300 block mb-0.5">กติกาสุ่ม Point Gacha:</span>
                                - หักยอดแต้มสะสม 15 แต้มต่อรอบการสุ่ม
                                <br />
                                - รางวัลมีสิทธิ์ได้ตั้งแต่เงินเครดิตวอลเล็ต, คูปองส่วนลดพิเศษ จนถึงเกลือสะสมโชค
                              </div>
                            )}

                            <button
                              onClick={handleSpinPointGacha}
                              disabled={spinLoading || !pointGachaTier}
                              className="w-full bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-zinc-950 font-black py-3 rounded-xl transition-all shadow-[0_4px_12px_rgba(245,158,11,0.2)] cursor-pointer active:scale-95 disabled:opacity-50 text-xs"
                            >
                              {spinLoading ? 'กำลังหมุนลุ้นโชค...' : 'หมุน Point Gacha (ใช้ 15 พอยท์) 🎰'}
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Storefront List */}
                      <div className="space-y-6">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                          <h3 className="text-base font-black text-white flex items-center gap-2">
                            <Gift className="w-5 h-5 text-amber-500" />
                            <span>รายการรางวัลพอยท์ช็อป (Point Exchange Items)</span>
                          </h3>

                          {/* Sub-tabs category filters */}
                          <div className="flex bg-zinc-900 border border-white/5 p-1 rounded-xl w-full sm:w-auto shrink-0 overflow-x-auto scrollbar-none font-sans">
                            {[
                              { id: 'all', label: 'ทั้งหมด' },
                              { id: 'credit', label: 'เงินสด' },
                              { id: 'coupon', label: 'คูปอง' },
                              { id: 'code', label: 'โค้ดสินค้า' }
                            ].map(subTab => (
                              <button
                                key={subTab.id}
                                onClick={() => setPointItemCategoryTab(subTab.id)}
                                className={`px-3.5 py-1.5 rounded-lg text-[11px] font-bold transition-all shrink-0 cursor-pointer ${
                                  pointItemCategoryTab === subTab.id
                                    ? 'bg-amber-500 text-amber-950 font-bold'
                                    : 'text-zinc-400 hover:text-white'
                                }`}
                              >
                                {subTab.label}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Success redeem details */}
                        {redeemSuccess && (
                          <div className="bg-emerald-500/10 border border-emerald-500/20 p-5 rounded-2xl flex items-start gap-3.5 text-xs text-emerald-400 animate-[zoomIn_0.3s_ease-out]">
                            <CheckCircle className="w-5 h-5 shrink-0 text-emerald-400 animate-bounce" />
                            <div className="space-y-1 text-left">
                              <span className="font-extrabold text-white block text-sm">{redeemSuccess.message}</span>
                              <span>ทำรายการแลกรางวัลเรียบร้อยแล้ว:</span>
                              {redeemSuccess.rewardType === 'coupon' && (
                                <div>
                                  <span>รหัสคูปองส่วนลดสะสม: </span>
                                  <strong className="bg-zinc-950 px-2 py-0.5 rounded font-mono text-amber-400 border border-white/5 select-all">{redeemSuccess.rewardValue.split('#')[0]}</strong>
                                </div>
                              )}
                              {redeemSuccess.rewardType === 'code' && (
                                <div>
                                  <span>รหัสโค้ดรางวัลที่คุณได้รับ: </span>
                                  <strong className="bg-zinc-950 px-2 py-0.5 rounded font-mono text-sky-400 border border-white/5 select-all">{redeemSuccess.rewardValue}</strong>
                                </div>
                              )}
                              {redeemSuccess.rewardType === 'credit' && (
                                <span>คุณได้รับเครดิตเข้ากระเป๋ามูลค่า {redeemSuccess.rewardValue} THB</span>
                              )}
                              <span className="text-[10px] text-zinc-500 block pt-1 leading-normal">
                                * รหัสบัตรของขวัญ / โค้ดเกมที่แลกได้จะบันทึกเก็บเข้าคลัง "คีย์สินค้า & รางวัล" และ "คูปองของฉัน" ของท่านโดยอัตโนมัติ เพื่อป้องกันการสูญหาย
                              </span>
                            </div>
                          </div>
                        )}

                        {itemsLoading ? (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {[1, 2].map(idx => (
                              <div key={idx} className="h-44 bg-zinc-950/20 border border-white/5 rounded-3xl animate-pulse" />
                            ))}
                          </div>
                        ) : filteredShopItems.length === 0 ? (
                          <div className="text-center py-16 bg-zinc-950/25 border border-white/5 rounded-3xl">
                            <p className="text-xs text-zinc-500">ไม่มีของรางวัลให้แลกชั่วคราวในหมวดหมู่นี้</p>
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                            {filteredShopItems.map(item => {
                              const isRedeeming = redeemingItem === item.id;
                              const hasPoints = (session?.user?.points || 0) >= item.point_cost;
                              const hasStock = item.stock > 0 || item.stock === -1;
                              const canRedeem = hasPoints && hasStock;

                              return (
                                <div
                                  key={item.id}
                                  className={`bg-zinc-950/30 border rounded-3xl overflow-hidden backdrop-blur-md transition-all duration-300 flex flex-col group ${
                                    canRedeem
                                      ? 'border-white/5 hover:border-amber-500/20 hover:shadow-[0_4px_20px_rgba(245,158,11,0.02)]'
                                      : 'border-white/5 opacity-80'
                                  }`}
                                >
                                  {/* Thumbnail */}
                                  <div className="h-32 relative overflow-hidden bg-zinc-900">
                                    <img
                                      src={item.image_url || 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=500&auto=format&fit=crop&q=60'}
                                      alt={item.name}
                                      className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-500"
                                    />
                                    <div className="absolute top-2.5 right-2.5 bg-amber-500 text-amber-950 font-black px-2.5 py-0.5 rounded-full text-[10px] flex items-center gap-1 shadow-md">
                                      <Coins className="w-3 h-3" />
                                      <span>{item.point_cost} แต้ม</span>
                                    </div>
                                    <div className="absolute bottom-2.5 left-2.5 bg-black/60 backdrop-blur-md text-white px-2 py-0.5 rounded text-[9px] font-bold border border-white/5 uppercase tracking-wider">
                                      {item.reward_type === 'credit' ? 'เงินสด' : item.reward_type === 'coupon' ? 'คูปอง' : 'คีย์โค้ด'}
                                    </div>
                                  </div>

                                  {/* Contexts */}
                                  <div className="p-4 flex-1 flex flex-col justify-between gap-3 text-left">
                                    <div className="space-y-0.5">
                                      <h4 className="text-xs font-bold text-white group-hover:text-amber-400 transition-colors leading-snug">
                                        {item.name}
                                      </h4>
                                      <p className="text-[10px] text-zinc-500 leading-normal">{item.description}</p>
                                    </div>

                                    <div className="pt-2 border-t border-white/5 flex items-center justify-between gap-4 text-[10px]">
                                      <span className="text-zinc-500 font-bold">
                                        {item.stock === -1 ? 'สต็อก: ไม่จำกัด' : `สต็อกเหลือ: ${item.stock} ชิ้น`}
                                      </span>

                                      <button
                                        onClick={() => handleRedeem(item)}
                                        disabled={!canRedeem || isRedeeming || redeemMutation.isPending}
                                        className={`px-3 py-1.5 rounded-xl text-[10px] font-black transition-all shrink-0 cursor-pointer active:scale-95 border-0 outline-none flex items-center gap-1.5 ${
                                          canRedeem
                                            ? 'bg-amber-500 hover:bg-amber-400 text-amber-950 shadow-[0_4px_10px_rgba(245,158,11,0.15)] font-bold'
                                            : 'bg-zinc-900 text-zinc-600 border border-white/5 cursor-not-allowed'
                                        }`}
                                      >
                                        {isRedeeming ? (
                                          <>
                                            <Loader2 className="w-3 h-3 animate-spin" />
                                            <span>กำลังแลก...</span>
                                          </>
                                        ) : !hasStock ? (
                                          <span>รางวัลหมด</span>
                                        ) : !hasPoints ? (
                                          <span>แต้มไม่พอ</span>
                                        ) : (
                                          <>
                                            <Gift className="w-3 h-3" />
                                            <span>แลกของรางวัล</span>
                                          </>
                                        )}
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* 5. DAILY QUESTS & POINT HISTORY TAB */}
                  {activeTab === 'quests' && (
                    <div className="space-y-6 animate-[fadeIn_0.4s_ease-out]">
                      
                      {/* Daily Quests Dashboard */}
                      <div className="bg-zinc-950/40 border border-white/5 rounded-3xl p-5 backdrop-blur-md space-y-4">
                        <span className="text-xs font-bold text-white uppercase tracking-wider block mb-1 font-sans">
                          ภารกิจแลกแต้มประจำวัน (Daily Quests checklist)
                        </span>

                        <div className="space-y-3">
                          {questsData.quests?.map(quest => {
                            const isClaiming = claimingQuest === quest.key;
                            
                            return (
                              <div key={quest.key} className="bg-zinc-900/50 border border-white/5 p-4 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 transition-all hover:bg-zinc-900/80">
                                <div className="space-y-1 text-left">
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs font-bold text-white">{quest.name}</span>
                                    <span className="text-[9px] font-black bg-amber-500/10 text-amber-500 border border-amber-500/20 px-1.5 py-0.5 rounded-md">
                                      +{quest.points} แต้ม 🪙
                                    </span>
                                  </div>
                                  <p className="text-[10px] text-zinc-500 leading-normal">{quest.desc}</p>
                                </div>

                                {quest.key === 'daily_checkin' ? (
                                  quest.completed ? (
                                    <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-xl flex items-center gap-1 select-none shrink-0">
                                      <CheckCircle className="w-3.5 h-3.5" />
                                      <span>ล็อกอินเช็คอินแล้ว</span>
                                    </span>
                                  ) : (
                                    <button
                                      onClick={handleCheckin}
                                      disabled={isClaiming || questMutation.isPending}
                                      className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-amber-950 text-[10px] font-black rounded-xl transition-all active:scale-95 disabled:opacity-50 shrink-0 cursor-pointer border-0 outline-none flex items-center gap-1.5"
                                    >
                                      {isClaiming ? <Loader2 className="w-3 h-3 animate-spin" /> : <Calendar className="w-3.5 h-3.5" />}
                                      <span>กดเช็คอิน</span>
                                    </button>
                                  )
                                ) : (
                                  quest.claimed ? (
                                    <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-xl flex items-center gap-1 select-none shrink-0">
                                      <CheckCircle className="w-3.5 h-3.5" />
                                      <span>รับรางวัลแล้ว</span>
                                    </span>
                                  ) : quest.completed ? (
                                    <button
                                      onClick={() => handleClaimQuest(quest.key)}
                                      disabled={isClaiming || questMutation.isPending}
                                      className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-emerald-950 text-[10px] font-black rounded-xl transition-all active:scale-95 disabled:opacity-50 shrink-0 cursor-pointer border-0 outline-none flex items-center gap-1.5"
                                    >
                                      {isClaiming ? <Loader2 className="w-3 h-3 animate-spin" /> : <Gift className="w-3.5 h-3.5" />}
                                      <span>กดรับแต้มสะสม</span>
                                    </button>
                                  ) : (
                                    <span className="text-[10px] font-bold text-zinc-600 bg-zinc-950 border border-white/5 px-3 py-1.5 rounded-xl select-none shrink-0">
                                      ยังไม่สำเร็จในวันนี้
                                    </span>
                                  )
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* VIP Ranks Benefits Guide */}
                      <div className="bg-zinc-950/40 border border-white/5 rounded-3xl p-5 backdrop-blur-md space-y-4">
                        <span className="text-xs font-bold text-white uppercase tracking-wider block font-sans">
                          ไกด์สิทธิประโยชน์ยศ VIP และสิทธิส่วนลดสะสม (VIP Member Ranks Guide)
                        </span>

                        <div className="overflow-x-auto rounded-2xl border border-white/5 bg-zinc-950/20">
                          <table className="w-full text-left text-[11px] border-collapse">
                            <thead>
                              <tr className="border-b border-white/10 bg-zinc-950/60 text-zinc-400 font-bold uppercase tracking-wider">
                                <th className="p-3">ระดับยศ (VIP Rank)</th>
                                <th className="p-3">เกณฑ์ยอดสะสม</th>
                                <th className="p-3">ส่วนลดสินค้า</th>
                                <th className="p-3">ตัวคูณแต้ม</th>
                                <th className="p-3">โบนัสฟรีที่ได้รับ</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5 text-zinc-300">
                              {RANKS.map((r, idx) => {
                                const isCurrent = userRank?.name === r.name;
                                let bonusText = '-';
                                if (r.name === 'Bronze VIP') bonusText = '+50฿ / +100 แต้ม';
                                else if (r.name === 'Silver VIP') bonusText = '+150฿ / +300 แต้ม';
                                else if (r.name === 'Gold VIP') bonusText = '+500฿ / +1000 แต้ม';
                                else if (r.name === 'Platinum VIP') bonusText = '+1500฿ / +3000 แต้ม';

                                let multiplierText = '1.0x';
                                if (r.name === 'Bronze VIP') multiplierText = '1.1x';
                                else if (r.name === 'Silver VIP') multiplierText = '1.2x';
                                else if (r.name === 'Gold VIP') multiplierText = '1.3x';
                                else if (r.name === 'Platinum VIP') multiplierText = '1.5x';

                                return (
                                  <tr key={r.name} className={`transition-colors ${isCurrent ? 'bg-sky-500/5 text-white font-bold' : 'hover:bg-white/5'}`}>
                                    <td className="p-3">
                                      <div className="flex items-center gap-1.5">
                                        <span className={`inline-flex items-center text-[9px] font-black px-2 py-0.5 rounded border tracking-wider select-none ${r.color}`}>
                                          {r.badge}
                                        </span>
                                        {isCurrent && <span className="text-[9px] text-sky-400 font-bold font-sans">ยศของคุณ 🌟</span>}
                                      </div>
                                    </td>
                                    <td className="p-3 font-mono">{r.minSpent.toLocaleString()} THB</td>
                                    <td className="p-3 font-mono text-purple-400 font-bold">{r.discountPercent}%</td>
                                    <td className="p-3 font-mono text-amber-500 font-bold">{multiplierText}</td>
                                    <td className="p-3 font-mono text-emerald-400 font-bold">{bonusText}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* Point Transactions Log */}
                      <div className="bg-zinc-950/40 border border-white/5 rounded-3xl p-5 backdrop-blur-md space-y-4">
                        <span className="text-xs font-bold text-white uppercase tracking-wider block font-sans">
                          ประวัติประมวลผลธุรกรรมพอยท์ล่าสุด (Points Transaction Log)
                        </span>

                        {questsData.history?.length === 0 ? (
                          <div className="text-center py-10 text-xs text-zinc-500">
                            ยังไม่มีรายการเคลื่อนไหวของแต้มสะสม
                          </div>
                        ) : (
                          <div className="space-y-3.5">
                            {questsData.history?.map((tx) => {
                              const displayDate = new Date(tx.created_at || tx.createdAt).toLocaleString('th-TH', {
                                dateStyle: 'medium',
                                timeStyle: 'short'
                              });

                              return (
                                <div key={tx.id} className="flex justify-between items-center bg-zinc-900/30 border border-white/5 p-4 rounded-2xl hover:border-white/10 transition-colors">
                                  <div className="space-y-1 text-left">
                                    <span className="text-xs text-zinc-200 font-semibold block leading-snug">
                                      {tx.description}
                                    </span>
                                    <span className="text-[10px] text-zinc-500 block font-mono">
                                      {displayDate}
                                    </span>
                                  </div>
                                  <span className={`text-sm font-black font-mono shrink-0 pl-4 ${
                                    tx.amount > 0 ? 'text-amber-400' : 'text-red-400'
                                  }`}>
                                    {tx.amount > 0 ? '+' : ''}{tx.amount} P
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>

                    </div>
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
