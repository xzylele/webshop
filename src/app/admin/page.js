'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Sliders, Plus, Edit2, Trash2, Users, ShoppingBag, Layers,
  CheckSquare, ArrowLeft, Loader2, Landmark, Smartphone, CreditCard, ShoppingCart,
  Tag, Power, Trash, DollarSign, Shield, ShieldAlert, Award, UserPlus, AlertCircle, User, Key, Save, X, Send, Ticket, Coins, Wallet
} from 'lucide-react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import ContactModal from '../components/ContactModal';
import HistoryModal from '../components/HistoryModal';
import AdminProductModal from '../components/AdminProductModal';
import AdminStockModal from '../components/AdminStockModal';
import AdminGachaStockModal from '../components/AdminGachaStockModal';
import AdminGachaTierManager from '../components/AdminGachaTierManager';
import CanvasBackground from '../components/CanvasBackground';
import { getUserRank, RANKS } from '@/lib/ranks';
import Link from 'next/link';

export default function AdminPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState('products'); // products | transactions | users | coupons | gacha | stats | banners | tickets | topup
  const [contactOpen, setContactOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  // Support Tickets Admin State
  const [selectedAdminTicketId, setSelectedAdminTicketId] = useState(null);
  const [adminReplyMessage, setAdminReplyMessage] = useState('');
  const [adminReplyError, setAdminReplyError] = useState('');

  // Banner management state
  const [bannerTitle, setBannerTitle] = useState('');
  const [bannerDesc, setBannerDesc] = useState('');
  const [bannerImgUrl, setBannerImgUrl] = useState('');
  const [bannerLinkUrl, setBannerLinkUrl] = useState('/products');
  const [bannerActionText, setBannerActionText] = useState('ดูสินค้าทั้งหมด');
  const [bannerImgMode, setBannerImgMode] = useState('url'); // 'url' | 'upload'
  const [bannerUploading, setBannerUploading] = useState(false);
  const [bannerError, setBannerError] = useState('');
  const [selectedBannerToEdit, setSelectedBannerToEdit] = useState(null);

  // AdminProductModal Control
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [selectedProductToEdit, setSelectedProductToEdit] = useState(null);

  // AdminStockModal Control
  const [stockModalOpen, setStockModalOpen] = useState(false);
  const [selectedProductForStock, setSelectedProductForStock] = useState(null);

  // User Management State
  const [userSearch, setUserSearch] = useState('');
  const [selectedUserForAdjust, setSelectedUserForAdjust] = useState(null);
  const [adjustAmount, setAdjustAmount] = useState('');
  const [adjustReason, setAdjustReason] = useState('');
  const [adjustSpent, setAdjustSpent] = useState(''); // ยอดซื้อสะสม (ใช้ปรับเปลี่ยนยศ Rank)
  const [adjustPoints, setAdjustPoints] = useState(''); // ยอดพอยท์สะสม
  const [adjustError, setAdjustError] = useState('');

  // Coupon State
  const [couponCode, setCouponCode] = useState('');
  const [couponDiscount, setCouponDiscount] = useState('');
  const [couponType, setCouponType] = useState('fixed'); // fixed | percentage
  const [couponMaxDiscount, setCouponMaxDiscount] = useState('');
  const [couponMinPurchase, setCouponMinPurchase] = useState('0');
  const [couponExpiresAt, setCouponExpiresAt] = useState('');
  const [couponMaxUsesPerUser, setCouponMaxUsesPerUser] = useState('1');
  const [couponError, setCouponError] = useState('');

  // Gacha State
  const [gachaName, setGachaName] = useState('');
  const [gachaType, setGachaType] = useState('empty'); // empty | coupon | code
  const [gachaChance, setGachaChance] = useState('10');
  const [gachaDiscount, setGachaDiscount] = useState('');
  const [gachaTopupAmount, setGachaTopupAmount] = useState('');
  const [gachaStock, setGachaStock] = useState('');
  const [gachaError, setGachaError] = useState('');
  const [selectedGachaTierId, setSelectedGachaTierId] = useState(null);
  const [gachaStockModalOpen, setGachaStockModalOpen] = useState(false);
  const [selectedGachaForStockManagement, setSelectedGachaForStockManagement] = useState(null);

  // Gacha Edit State
  const [selectedGachaToEdit, setSelectedGachaToEdit] = useState(null);
  const [editGachaName, setEditGachaName] = useState('');
  const [editGachaChance, setEditGachaChance] = useState('10');
  const [editGachaDiscount, setEditGachaDiscount] = useState('');
  const [editGachaTopupAmount, setEditGachaTopupAmount] = useState('');
  const [editGachaError, setEditGachaError] = useState('');

  // Point Shop Management States
  const [pointItemName, setPointItemName] = useState('');
  const [pointItemDesc, setPointItemDesc] = useState('');
  const [pointItemCost, setPointItemCost] = useState('');
  const [pointItemImg, setPointItemImg] = useState('');
  const [pointItemRewardType, setPointItemRewardType] = useState('credit'); // credit | coupon | code
  const [pointItemRewardVal, setPointItemRewardVal] = useState(''); // amount / discount / codes list
  const [pointItemStock, setPointItemStock] = useState('-1');
  const [pointItemActive, setPointItemActive] = useState(true);
  const [selectedPointItemToEdit, setSelectedPointItemToEdit] = useState(null);
  const [pointItemError, setPointItemError] = useState('');
  const [pointShopAdminSubTab, setPointShopAdminSubTab] = useState('items'); // items | history

  // Topup settings state
  const [topupForm, setTopupForm] = useState(null);

  // Query: Topup config
  const { data: topupConfig, isLoading: topupConfigLoading } = useQuery({
    queryKey: ['admin-topup-config'],
    queryFn: async () => {
      const res = await fetch('/api/admin/topup-config');
      if (!res.ok) throw new Error('Failed to load topup config');
      return res.json();
    },
    enabled: status === 'authenticated' && session?.user?.role === 'admin',
  });

  // Sync config query to local state
  useEffect(() => {
    if (topupConfig) {
      setTopupForm(topupConfig);
    } else if (topupConfig === undefined && !topupConfigLoading) {
      setTopupForm({
        promptpay: { enabled: true, promptpayId: '004999038911094', expectedName: 'สมัชญ์' },
        wallet: { enabled: true },
        cashcard: { enabled: true, feePercent: 15 },
        giftcode: { enabled: true }
      });
    }
  }, [topupConfig, topupConfigLoading]);

  // Mutation: Save topup config
  const updateTopupConfigMutation = useMutation({
    mutationFn: async (newConfig) => {
      const res = await fetch('/api/admin/topup-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newConfig),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'เกิดข้อผิดพลาดในการบันทึกการตั้งค่า');
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-topup-config'] });
      alert('บันทึกการตั้งค่าระบบเติมเงินสำเร็จแล้ว!');
    },
    onError: (err) => {
      alert(err.message);
    }
  });

  // Redirect if not admin
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    } else if (session && session.user.role !== 'admin') {
      router.push('/');
    }
  }, [session, status, router]);

  // Open tab/ticket from notification link (?tab=tickets&ticket=...)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get('tab');
    const ticket = params.get('ticket');
    if (tab) setActiveTab(tab);
    if (ticket) setSelectedAdminTicketId(ticket);
  }, []);

  // Query: Stats
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['stats'],
    queryFn: async () => {
      const res = await fetch('/api/stats');
      if (!res.ok) throw new Error('Failed to load stats');
      return res.json();
    },
    enabled: status === 'authenticated' && session?.user?.role === 'admin',
  });

  // Query: Point Shop Items
  const { data: adminPointShopData = { items: [], isX2Active: false }, isLoading: adminPointShopLoading } = useQuery({
    queryKey: ['admin-point-shop'],
    queryFn: async () => {
      const res = await fetch('/api/admin/point-shop');
      if (!res.ok) throw new Error('Failed to load point shop items');
      return res.json();
    },
    enabled: status === 'authenticated' && session?.user?.role === 'admin',
  });

  // Mutations: Point Shop Items
  const toggleX2Mutation = useMutation({
    mutationFn: async (active) => {
      const res = await fetch('/api/admin/point-shop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'toggle_x2', active }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to toggle X2');
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-point-shop'] });
    },
  });

  const createPointItemMutation = useMutation({
    mutationFn: async (payload) => {
      const res = await fetch('/api/admin/point-shop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'สร้างของรางวัลล้มเหลว');
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-point-shop'] });
      setPointItemName('');
      setPointItemDesc('');
      setPointItemCost('');
      setPointItemImg('');
      setPointItemRewardType('credit');
      setPointItemRewardVal('');
      setPointItemStock('-1');
      setPointItemActive(true);
      setPointItemError('');
    },
    onError: (err) => {
      setPointItemError(err.message);
    }
  });

  const updatePointItemMutation = useMutation({
    mutationFn: async (payload) => {
      const res = await fetch('/api/admin/point-shop', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'แก้ไขของรางวัลล้มเหลว');
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-point-shop'] });
      setSelectedPointItemToEdit(null);
      setPointItemName('');
      setPointItemDesc('');
      setPointItemCost('');
      setPointItemImg('');
      setPointItemRewardType('credit');
      setPointItemRewardVal('');
      setPointItemStock('-1');
      setPointItemActive(true);
      setPointItemError('');
    },
    onError: (err) => {
      setPointItemError(err.message);
    }
  });

  const deletePointItemMutation = useMutation({
    mutationFn: async (id) => {
      const res = await fetch(`/api/admin/point-shop?id=${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'ลบของรางวัลล้มเหลว');
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-point-shop'] });
    }
  });

  const handleCreatePointItem = (e) => {
    e.preventDefault();
    setPointItemError('');
    if (!pointItemName || !pointItemCost || isNaN(pointItemCost) || Number(pointItemCost) <= 0) {
      setPointItemError('กรุณากรอกชื่อและแต้มสะสมที่ต้องการให้ถูกต้อง');
      return;
    }

    let parsedRewardData = {};
    if (pointItemRewardType === 'credit') {
      parsedRewardData = { amount: Number(pointItemRewardVal) || 0 };
    } else if (pointItemRewardType === 'coupon') {
      parsedRewardData = { discount: Number(pointItemRewardVal) || 0 };
    } else if (pointItemRewardType === 'code') {
      const codes = pointItemRewardVal.split('\n').map(c => c.trim()).filter(Boolean);
      parsedRewardData = { codes };
    }

    createPointItemMutation.mutate({
      name: pointItemName,
      description: pointItemDesc,
      pointCost: Number(pointItemCost),
      imageUrl: pointItemImg,
      rewardType: pointItemRewardType,
      rewardData: parsedRewardData,
      stock: pointItemStock !== '' ? Number(pointItemStock) : -1,
      isActive: pointItemActive
    });
  };

  const handleEditPointItemSubmit = (e) => {
    e.preventDefault();
    setPointItemError('');
    if (!pointItemName || !pointItemCost || isNaN(pointItemCost) || Number(pointItemCost) <= 0) {
      setPointItemError('กรุณากรอกชื่อและแต้มสะสมที่ต้องการให้ถูกต้อง');
      return;
    }

    let parsedRewardData = {};
    if (pointItemRewardType === 'credit') {
      parsedRewardData = { amount: Number(pointItemRewardVal) || 0 };
    } else if (pointItemRewardType === 'coupon') {
      parsedRewardData = { discount: Number(pointItemRewardVal) || 0 };
    } else if (pointItemRewardType === 'code') {
      const codes = pointItemRewardVal.split('\n').map(c => c.trim()).filter(Boolean);
      parsedRewardData = { codes };
    }

    updatePointItemMutation.mutate({
      id: selectedPointItemToEdit.id,
      name: pointItemName,
      description: pointItemDesc,
      pointCost: Number(pointItemCost),
      imageUrl: pointItemImg,
      rewardType: pointItemRewardType,
      rewardData: parsedRewardData,
      stock: pointItemStock !== '' ? Number(pointItemStock) : -1,
      isActive: pointItemActive
    });
  };

  const handleStartEditPointItem = (item) => {
    setSelectedPointItemToEdit(item);
    setPointItemName(item.name);
    setPointItemDesc(item.description || '');
    setPointItemCost(String(item.point_cost));
    setPointItemImg(item.image_url || '');
    setPointItemRewardType(item.reward_type);
    
    let rewardVal = '';
    const rData = item.reward_data || {};
    if (item.reward_type === 'credit') {
      rewardVal = String(rData.amount || '');
    } else if (item.reward_type === 'coupon') {
      rewardVal = String(rData.discount || '');
    } else if (item.reward_type === 'code') {
      rewardVal = (rData.codes || []).join('\n');
    }
    setPointItemRewardVal(rewardVal);
    setPointItemStock(String(item.stock));
    setPointItemActive(item.is_active);
    setPointItemError('');
  };

  const handleStartEditGachaItem = (item) => {
    setSelectedGachaToEdit(item);
    setEditGachaName(item.name);
    setEditGachaChance(String(item.chance));
    setEditGachaDiscount(item.couponDiscount ? String(item.couponDiscount) : '');
    setEditGachaTopupAmount(item.topupAmount ? String(item.topupAmount) : '');
    setEditGachaError('');
  };

  // Query: Products
  const { data: products = [], isLoading: productsLoading } = useQuery({
    queryKey: ['products'],
    queryFn: async () => {
      const res = await fetch('/api/products');
      if (!res.ok) throw new Error('Failed to load products');
      return res.json();
    },
    enabled: status === 'authenticated' && session?.user?.role === 'admin',
  });

  // Query: Transactions
  const { data: allTransactions = [], isLoading: transactionsLoading } = useQuery({
    queryKey: ['all-transactions'],
    queryFn: async () => {
      const res = await fetch('/api/admin/transactions');
      if (!res.ok) throw new Error('Failed to load transactions');
      return res.json();
    },
    enabled: status === 'authenticated' && session?.user?.role === 'admin',
  });

  // Query: Admin Support Tickets
  const { data: adminTickets = [], isLoading: adminTicketsLoading } = useQuery({
    queryKey: ['admin-tickets'],
    queryFn: async () => {
      const res = await fetch('/api/support/tickets');
      if (!res.ok) throw new Error('Failed to load support tickets');
      return res.json();
    },
    enabled: status === 'authenticated' && session?.user?.role === 'admin',
  });

  // Query: Admin Support Messages
  const { data: adminTicketMessages = [], isLoading: adminTicketMessagesLoading } = useQuery({
    queryKey: ['admin-ticket-messages', selectedAdminTicketId],
    queryFn: async () => {
      const res = await fetch(`/api/support/tickets/messages?ticketId=${selectedAdminTicketId}`);
      if (!res.ok) throw new Error('Failed to load ticket messages');
      return res.json();
    },
    enabled: !!selectedAdminTicketId && session?.user?.role === 'admin',
  });

  // Mutation: Admin Reply Message
  const adminSendReplyMutation = useMutation({
    mutationFn: async (payload) => {
      const res = await fetch('/api/support/tickets/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send reply');
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-ticket-messages', selectedAdminTicketId] });
      queryClient.invalidateQueries({ queryKey: ['admin-tickets'] });
      setAdminReplyMessage('');
      setAdminReplyError('');
    },
    onError: (err) => {
      setAdminReplyError(err.message);
    }
  });

  // Mutation: Admin Close Ticket
  const adminCloseTicketMutation = useMutation({
    mutationFn: async (ticketId) => {
      const res = await fetch('/api/support/tickets/status', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticketId, status: 'closed' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to close ticket');
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-tickets'] });
      queryClient.invalidateQueries({ queryKey: ['admin-ticket-messages', selectedAdminTicketId] });
    }
  });

  // Mutation: Admin Refund Ticket
  const adminRefundTicketMutation = useMutation({
    mutationFn: async (ticketId) => {
      const res = await fetch('/api/admin/support/refund', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticketId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to refund ticket');
      return data;
    },
    onSuccess: (data) => {
      alert(`ดำเนินการคืนเงินสำเร็จจำนวน ${data.refundAmount} THB แก่ลูกค้าแล้ว!`);
      queryClient.invalidateQueries({ queryKey: ['admin-tickets'] });
      queryClient.invalidateQueries({ queryKey: ['admin-ticket-messages', selectedAdminTicketId] });
      queryClient.invalidateQueries({ queryKey: ['all-transactions'] });
    },
    onError: (err) => {
      alert(`ไม่สามารถอนุมัติคืนเงินได้: ${err.message}`);
    }
  });

  // Query: Users
  const { data: users = [], isLoading: usersLoading } = useQuery({
    queryKey: ['admin-users', userSearch],
    queryFn: async () => {
      const url = userSearch ? `/api/admin/users?search=${encodeURIComponent(userSearch)}` : '/api/admin/users';
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to load users');
      return res.json();
    },
    enabled: status === 'authenticated' && session?.user?.role === 'admin',
  });

  // Query: Coupons
  const { data: coupons = [], isLoading: couponsLoading } = useQuery({
    queryKey: ['admin-coupons'],
    queryFn: async () => {
      const res = await fetch('/api/admin/coupons');
      if (!res.ok) throw new Error('Failed to load coupons');
      return res.json();
    },
    enabled: status === 'authenticated' && session?.user?.role === 'admin',
  });

  // Query: Gacha tiers and tier-scoped items
  const { data: gachaTiers = [], isLoading: gachaTiersLoading } = useQuery({
    queryKey: ['admin-gacha-tiers'],
    queryFn: async () => {
      const res = await fetch('/api/admin/gacha/tiers');
      if (!res.ok) throw new Error('Failed to load gacha tiers');
      return res.json();
    },
    enabled: status === 'authenticated' && session?.user?.role === 'admin',
  });

  const displayGachaTiers = gachaTiers.filter(tier => tier.slug !== 'point');
  const selectedGachaTier = displayGachaTiers.find(tier => tier.id === selectedGachaTierId) || displayGachaTiers[0] || null;

  const { data: gachaItems = [], isLoading: gachaLoading } = useQuery({
    queryKey: ['admin-gacha', selectedGachaTier?.id],
    queryFn: async () => {
      const res = await fetch('/api/admin/gacha?tierId=' + selectedGachaTier.id);
      if (!res.ok) throw new Error('Failed to load gacha items');
      return res.json();
    },
    enabled: status === 'authenticated' && session?.user?.role === 'admin' && Boolean(selectedGachaTier?.id),
  });

  const pointGachaTier = gachaTiers.find(tier => tier.slug === 'point');

  const { data: pointGachaItems = [], isLoading: pointGachaLoading } = useQuery({
    queryKey: ['admin-point-gacha', pointGachaTier?.id],
    queryFn: async () => {
      const res = await fetch('/api/admin/gacha?tierId=' + pointGachaTier.id);
      if (!res.ok) throw new Error('Failed to load point gacha items');
      return res.json();
    },
    enabled: status === 'authenticated' && session?.user?.role === 'admin' && Boolean(pointGachaTier?.id),
  });

  // Query: Banners
  const { data: bannersList = [], isLoading: bannersLoading } = useQuery({
    queryKey: ['admin-banners'],
    queryFn: async () => {
      const res = await fetch('/api/admin/banners');
      if (!res.ok) throw new Error('Failed to load banners');
      return res.json();
    },
    enabled: status === 'authenticated' && session?.user?.role === 'admin',
  });

  // Mutations: Products
  const deleteProductMutation = useMutation({
    mutationFn: async (id) => {
      const res = await fetch(`/api/admin/products?id=${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'ลบสินค้าล้มเหลว');
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
    },
  });

  // Mutations: Users role & balance
  const updateUserMutation = useMutation({
    mutationFn: async (payload) => {
      const res = await fetch('/api/admin/users', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'บันทึกข้อมูลผู้ใช้ล้มเหลว');
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      queryClient.invalidateQueries({ queryKey: ['all-transactions'] });
      setSelectedUserForAdjust(null);
      setAdjustAmount('');
      setAdjustReason('');
      setAdjustSpent('');
      setAdjustPoints('');
      setAdjustError('');
    },
    onError: (err) => {
      setAdjustError(err.message);
    }
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (userId) => {
      const res = await fetch(`/api/admin/users?userId=${userId}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'ลบผู้ใช้ล้มเหลว');
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      queryClient.invalidateQueries({ queryKey: ['all-transactions'] });
    },
    onError: (err) => {
      alert(err.message);
    }
  });

  // Mutations: Coupons
  const createCouponMutation = useMutation({
    mutationFn: async (payload) => {
      const res = await fetch('/api/admin/coupons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'สร้างคูปองล้มเหลว');
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-coupons'] });
      setCouponCode('');
      setCouponDiscount('');
      setCouponType('fixed');
      setCouponMaxDiscount('');
      setCouponMinPurchase('0');
      setCouponExpiresAt('');
      setCouponMaxUsesPerUser('1');
      setCouponError('');
    },
    onError: (err) => {
      setCouponError(err.message);
    }
  });

  const toggleCouponMutation = useMutation({
    mutationFn: async (payload) => {
      const res = await fetch('/api/admin/coupons', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'แก้ไขคูปองล้มเหลว');
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-coupons'] });
    }
  });

  const deleteCouponMutation = useMutation({
    mutationFn: async (id) => {
      const res = await fetch(`/api/admin/coupons?id=${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'ลบคูปองล้มเหลว');
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-coupons'] });
    }
  });

  // Mutations: Gacha
const createGachaTierMutation = useMutation({
    mutationFn: async payload => {
      const res = await fetch('/api/admin/gacha/tiers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Cannot create tier');
      return data;
    },
    onSuccess: data => { queryClient.invalidateQueries({ queryKey: ['admin-gacha-tiers'] }); setSelectedGachaTierId(data.tier.id); },
  });
  const updateGachaTierMutation = useMutation({
    mutationFn: async payload => {
      const res = await fetch('/api/admin/gacha/tiers', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Cannot update tier');
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-gacha-tiers'] }),
  });
  const deleteGachaTierMutation = useMutation({
    mutationFn: async tier => {
      const res = await fetch('/api/admin/gacha/tiers?id=' + tier.id, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Cannot delete tier');
      return data;
    },
    onSuccess: () => { setSelectedGachaTierId(null); queryClient.invalidateQueries({ queryKey: ['admin-gacha-tiers'] }); },
  });

  const createGachaItemMutation = useMutation({
    mutationFn: async (payload) => {
      const res = await fetch('/api/admin/gacha', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'สร้างของรางวัลล้มเหลว');
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-gacha'] });
      queryClient.invalidateQueries({ queryKey: ['admin-gacha-tiers'] });
      queryClient.invalidateQueries({ queryKey: ['admin-point-gacha'] });
      setGachaName('');
      setGachaType('empty');
      setGachaChance('10');
      setGachaDiscount('');
      setGachaTopupAmount('');
      setGachaStock('');
      setGachaError('');
    },
    onError: (err) => {
      setGachaError(err.message);
    }
  });

  const updateGachaItemMutation = useMutation({
    mutationFn: async (payload) => {
      const res = await fetch('/api/admin/gacha', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'บันทึกข้อมูลของรางวัลล้มเหลว');
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-gacha'] });
      queryClient.invalidateQueries({ queryKey: ['admin-gacha-tiers'] });
      queryClient.invalidateQueries({ queryKey: ['admin-point-gacha'] });
      setSelectedGachaForStockManagement(null);
      setSelectedGachaToEdit(null);
      setEditGachaName('');
      setEditGachaChance('10');
      setEditGachaDiscount('');
      setEditGachaTopupAmount('');
      setEditGachaError('');
    },
    onError: (err) => {
      setEditGachaError(err.message);
    }
  });

  const deleteGachaItemMutation = useMutation({
    mutationFn: async (id) => {
      const res = await fetch(`/api/admin/gacha?id=${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'ลบของรางวัลล้มเหลว');
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-gacha'] });
      queryClient.invalidateQueries({ queryKey: ['admin-gacha-tiers'] });
      queryClient.invalidateQueries({ queryKey: ['admin-point-gacha'] });
    }
  });

  // Mutations: Banners
  const createBannerMutation = useMutation({
    mutationFn: async (payload) => {
      const res = await fetch('/api/admin/banners', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'สร้างแบนเนอร์ล้มเหลว');
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-banners'] });
      setBannerTitle('');
      setBannerDesc('');
      setBannerImgUrl('');
      setBannerLinkUrl('/products');
      setBannerActionText('ดูสินค้าทั้งหมด');
      setBannerError('');
    },
    onError: (err) => {
      setBannerError(err.message);
    }
  });

  const updateBannerMutation = useMutation({
    mutationFn: async (payload) => {
      const res = await fetch('/api/admin/banners', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'แก้ไขแบนเนอร์ล้มเหลว');
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-banners'] });
      setSelectedBannerToEdit(null);
      setBannerTitle('');
      setBannerDesc('');
      setBannerImgUrl('');
      setBannerLinkUrl('/products');
      setBannerActionText('ดูสินค้าทั้งหมด');
      setBannerError('');
    },
    onError: (err) => {
      setBannerError(err.message);
    }
  });

  const deleteBannerMutation = useMutation({
    mutationFn: async (id) => {
      const res = await fetch(`/api/admin/banners?id=${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'ลบแบนเนอร์ล้มเหลว');
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-banners'] });
    }
  });

  const handleBannerFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setBannerUploading(true);
    setBannerError('');

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/admin/banners/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'อัปโหลดภาพล้มเหลว');

      setBannerImgUrl(data.imageUrl);
    } catch (err) {
      setBannerError(err.message);
    } finally {
      setBannerUploading(false);
    }
  };

  const handleCreateBanner = (e) => {
    e.preventDefault();
    setBannerError('');
    if (!bannerImgUrl) {
      setBannerError('กรุณากรอกหรืออัปโหลดรูปภาพแบนเนอร์');
      return;
    }

    createBannerMutation.mutate({
      title: bannerTitle,
      description: bannerDesc,
      image_url: bannerImgUrl,
      link_url: bannerLinkUrl,
      action_text: bannerActionText,
    });
  };

  const handleEditBannerSubmit = (e) => {
    e.preventDefault();
    setBannerError('');
    if (!bannerImgUrl) {
      setBannerError('กรุณากรอกหรืออัปโหลดรูปภาพแบนเนอร์');
      return;
    }

    updateBannerMutation.mutate({
      id: selectedBannerToEdit._id,
      title: bannerTitle,
      description: bannerDesc,
      image_url: bannerImgUrl,
      link_url: bannerLinkUrl,
      action_text: bannerActionText,
    });
  };

  const handleEditBanner = (banner) => {
    setSelectedBannerToEdit(banner);
    setBannerTitle(banner.title);
    setBannerDesc(banner.description || '');
    setBannerImgUrl(banner.image_url);
    setBannerLinkUrl(banner.link_url);
    setBannerActionText(banner.action_text);
    setBannerImgMode('url');
    setBannerError('');
  };

  const handleDeleteBanner = (id, title) => {
    if (window.confirm(`คุณแน่ใจหรือไม่ว่าต้องการลบแบนเนอร์ "${title}"?`)) {
      deleteBannerMutation.mutate(id);
    }
  };

  const handleAdjustBalance = (e) => {
    e.preventDefault();
    setAdjustError('');

    const payload = { userId: selectedUserForAdjust._id };

    // 1. ตรวจสอบการปรับเงิน
    if (adjustAmount !== '' && adjustAmount !== '0') {
      if (isNaN(adjustAmount)) {
        setAdjustError('กรุณากรอกยอดเงินปรับปรุงที่ถูกต้อง');
        return;
      }
      if (!adjustReason) {
        setAdjustError('กรุณากรอกเหตุผลในการแก้ไขยอดเงิน');
        return;
      }
      payload.balanceAdjustment = Number(adjustAmount);
      payload.reason = adjustReason;
    }

    // 2. ตรวจสอบการปรับยศยอดสะสม
    if (adjustSpent !== '') {
      if (isNaN(adjustSpent) || Number(adjustSpent) < 0) {
        setAdjustError('กรุณากรอกยอดซื้อสะสมสะสมที่ถูกต้อง');
        return;
      }
      payload.newTotalSpent = Number(adjustSpent);
    }

    // 3. ตรวจสอบการปรับแต้มสะสม
    if (adjustPoints !== '' && adjustPoints !== '0') {
      if (isNaN(adjustPoints)) {
        setAdjustError('กรุณากรอกยอดพอยท์ที่ต้องการปรับปรุงให้ถูกต้อง');
        return;
      }
      payload.pointsAdjustment = Number(adjustPoints);
      if (payload.reason === undefined) {
        payload.reason = adjustReason || 'ปรับแต้มสะสมโดยผู้ดูแลระบบ';
      }
    }

    if (
      payload.balanceAdjustment === undefined &&
      payload.newTotalSpent === undefined &&
      payload.pointsAdjustment === undefined
    ) {
      setAdjustError('กรุณากรอกอย่างน้อย 1 รายการเพื่ออัปเดต');
      return;
    }

    updateUserMutation.mutate(payload);
  };

  const handleCreateCoupon = (e) => {
    e.preventDefault();
    setCouponError('');
    if (!couponCode || !couponDiscount || isNaN(couponDiscount) || couponDiscount < 0) {
      setCouponError('กรุณากรอกรหัสคูปองและมูลค่าส่วนลดให้ถูกต้อง');
      return;
    }

    createCouponMutation.mutate({
      code: couponCode,
      discount: Number(couponDiscount),
      type: couponType,
      maxDiscount: couponMaxDiscount ? Number(couponMaxDiscount) : null,
      minPurchase: couponMinPurchase ? Number(couponMinPurchase) : 0,
      expiresAt: couponExpiresAt || null,
      maxUsesPerUser: couponMaxUsesPerUser ? Number(couponMaxUsesPerUser) : 1
    });
  };

  const handleCreateGachaItem = (e, tierIdOverride = null) => {
    e.preventDefault();
    setGachaError('');
    if (!gachaName || !gachaType || gachaChance === '' || isNaN(gachaChance)) {
      setGachaError('กรุณากรอกข้อมูลให้ครบถ้วน');
      return;
    }
    if (gachaType === 'coupon' && (!gachaDiscount || isNaN(gachaDiscount))) {
      setGachaError('กรุณากรอกมูลค่าส่วนลดให้ถูกต้อง');
      return;
    }
    if (gachaType === 'topup' && (!gachaTopupAmount || isNaN(gachaTopupAmount))) {
      setGachaError('กรุณากรอกยอดเงินเติมเข้าเว็บให้ถูกต้อง');
      return;
    }

    const activeTierId = tierIdOverride || selectedGachaTier?.id;
    if (!activeTierId) { setGachaError('Please select a gacha tier'); return; }

    createGachaItemMutation.mutate({
      tierId: activeTierId,
      name: gachaName,
      type: gachaType,
      chance: Number(gachaChance),
      couponDiscount: gachaType === 'coupon' ? Number(gachaDiscount) : undefined,
      topupAmount: gachaType === 'topup' ? Number(gachaTopupAmount) : undefined,
      stockInput: gachaType === 'code' ? gachaStock : undefined,
    });
  };

  const handleEditGachaItemSubmit = (e) => {
    e.preventDefault();
    setEditGachaError('');
    if (!editGachaName || editGachaChance === '' || isNaN(editGachaChance)) {
      setEditGachaError('กรุณากรอกข้อมูลรางวัลให้ถูกต้อง');
      return;
    }
    if (selectedGachaToEdit.type === 'coupon' && (!editGachaDiscount || isNaN(editGachaDiscount))) {
      setEditGachaError('กรุณากรอกมูลค่าส่วนลดให้ถูกต้อง');
      return;
    }
    if (selectedGachaToEdit.type === 'topup' && (!editGachaTopupAmount || isNaN(editGachaTopupAmount))) {
      setEditGachaError('กรุณากรอกยอดเงินเติมเข้าเว็บให้ถูกต้อง');
      return;
    }

    updateGachaItemMutation.mutate({
      id: selectedGachaToEdit._id,
      tierId: selectedGachaToEdit.tierId,
      name: editGachaName,
      chance: Number(editGachaChance),
      couponDiscount: selectedGachaToEdit.type === 'coupon' ? Number(editGachaDiscount) : undefined,
      topupAmount: selectedGachaToEdit.type === 'topup' ? Number(editGachaTopupAmount) : undefined
    });
  };

  const handleDeleteProduct = (id, name) => {
    if (window.confirm(`คุณแน่ใจหรือไม่ว่าต้องการลบสินค้า "${name}"?`)) {
      deleteProductMutation.mutate(id);
    }
  };

  const handleEditProduct = (product) => {
    setSelectedProductToEdit(product);
    setProductModalOpen(true);
  };

  const handleAddProduct = () => {
    setSelectedProductToEdit(null);
    setProductModalOpen(true);
  };

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#02060d] text-zinc-500 gap-3">
        <Loader2 className="w-8 h-8 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm">กำลังตรวจสอบสิทธิ์แอดมิน...</p>
      </div>
    );
  }

  if (!session || session.user.role !== 'admin') {
    return null;
  }

  // คำนวณหาน้ำหนักรวมของวงล้อ Gacha สำหรับหา % อัตราสุ่มเรียลไทม์

  return (
    <div className="relative min-h-screen flex flex-col bg-[#02060d]">
      <CanvasBackground />
      <Navbar onOpenContact={() => setContactOpen(true)} onOpenHistory={() => setHistoryOpen(true)} />

      {/* Main Admin Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10 relative z-10">

        {/* Header Title */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-black text-white flex items-center gap-2">
              <Sliders className="w-6 h-6 text-sky-400" />
              <span>แผงจัดการระบบหลังบ้าน (Admin Panel)</span>
            </h1>
            <p className="text-xs text-zinc-400 mt-1">บริหารจัดการสินค้า บัญชีผู้ใช้ คูปองส่วนลด รายการธุรกรรม และสถิติ NakataShop</p>
          </div>

          <Link
            href="/"
            className="flex items-center gap-2 self-start sm:self-center text-xs font-semibold bg-zinc-900 text-zinc-300 border border-white/5 px-4 py-2.5 rounded-xl hover:text-white hover:bg-zinc-800 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>กลับหน้าหลักร้านค้า</span>
          </Link>
        </div>

        {/* Tab Buttons Navigation */}
        <div className="flex flex-wrap items-center gap-2 pb-4 mb-8 border-b border-white/5">
          <button
            onClick={() => setActiveTab('products')}
            className={`px-5 py-2.5 rounded-xl text-xs font-semibold whitespace-nowrap border transition-all cursor-pointer duration-300 ${activeTab === 'products'
                ? 'bg-sky-500/10 text-sky-400 border-sky-500/30 shadow-[0_0_15px_rgba(14,165,233,0.15)] font-bold'
                : 'bg-zinc-950/20 border-white/5 text-zinc-400 hover:text-white hover:border-white/10 hover:bg-zinc-900/40'
              }`}
          >
            จัดการคลังสินค้า ({products.length})
          </button>

          <button
            onClick={() => setActiveTab('users')}
            className={`px-5 py-2.5 rounded-xl text-xs font-semibold whitespace-nowrap border transition-all cursor-pointer duration-300 ${activeTab === 'users'
                ? 'bg-sky-500/10 text-sky-400 border-sky-500/30 shadow-[0_0_15px_rgba(14,165,233,0.15)] font-bold'
                : 'bg-zinc-950/20 border-white/5 text-zinc-400 hover:text-white hover:border-white/10 hover:bg-zinc-900/40'
              }`}
          >
            จัดการผู้ใช้งาน ({users.length})
          </button>

          <button
            onClick={() => setActiveTab('coupons')}
            className={`px-5 py-2.5 rounded-xl text-xs font-semibold whitespace-nowrap border transition-all cursor-pointer duration-300 ${activeTab === 'coupons'
                ? 'bg-sky-500/10 text-sky-400 border-sky-500/30 shadow-[0_0_15px_rgba(14,165,233,0.15)] font-bold'
                : 'bg-zinc-950/20 border-white/5 text-zinc-400 hover:text-white hover:border-white/10 hover:bg-zinc-900/40'
              }`}
          >
            จัดการคูปองส่วนลด ({coupons.length})
          </button>

          <button
            onClick={() => setActiveTab('gacha')}
            className={`px-5 py-2.5 rounded-xl text-xs font-semibold whitespace-nowrap border transition-all cursor-pointer duration-300 ${activeTab === 'gacha'
                ? 'bg-sky-500/10 text-sky-400 border-sky-500/30 shadow-[0_0_15px_rgba(14,165,233,0.15)] font-bold'
                : 'bg-zinc-950/20 border-white/5 text-zinc-400 hover:text-white hover:border-white/10 hover:bg-zinc-900/40'
              }`}
          >
            จัดการวงล้อ Gacha ({gachaItems.length})
          </button>

          <button
            onClick={() => setActiveTab('transactions')}
            className={`px-5 py-2.5 rounded-xl text-xs font-semibold whitespace-nowrap border transition-all cursor-pointer duration-300 ${activeTab === 'transactions'
                ? 'bg-sky-500/10 text-sky-400 border-sky-500/30 shadow-[0_0_15px_rgba(14,165,233,0.15)] font-bold'
                : 'bg-zinc-950/20 border-white/5 text-zinc-400 hover:text-white hover:border-white/10 hover:bg-zinc-900/40'
              }`}
          >
            ทรานแซกชั่นของระบบ ({allTransactions.length})
          </button>

          <button
            onClick={() => setActiveTab('banners')}
            className={`px-5 py-2.5 rounded-xl text-xs font-semibold whitespace-nowrap border transition-all cursor-pointer duration-300 ${activeTab === 'banners'
                ? 'bg-sky-500/10 text-sky-400 border-sky-500/30 shadow-[0_0_15px_rgba(14,165,233,0.15)] font-bold'
                : 'bg-zinc-950/20 border-white/5 text-zinc-400 hover:text-white hover:border-white/10 hover:bg-zinc-900/40'
              }`}
          >
            จัดการ Banner ({bannersList.length})
          </button>

          <button
            onClick={() => setActiveTab('stats')}
            className={`px-5 py-2.5 rounded-xl text-xs font-semibold whitespace-nowrap border transition-all cursor-pointer duration-300 ${activeTab === 'stats'
                ? 'bg-sky-500/10 text-sky-400 border-sky-500/30 shadow-[0_0_15px_rgba(14,165,233,0.15)] font-bold'
                : 'bg-zinc-950/20 border-white/5 text-zinc-400 hover:text-white hover:border-white/10 hover:bg-zinc-900/40'
              }`}
          >
            สรุปรายงานแดชบอร์ด
          </button>

          <button
            onClick={() => setActiveTab('tickets')}
            className={`px-5 py-2.5 rounded-xl text-xs font-semibold whitespace-nowrap border transition-all cursor-pointer duration-300 ${activeTab === 'tickets'
                ? 'bg-sky-500/10 text-sky-400 border-sky-500/30 shadow-[0_0_15px_rgba(14,165,233,0.15)] font-bold'
                : 'bg-zinc-950/20 border-white/5 text-zinc-400 hover:text-white hover:border-white/10 hover:bg-zinc-900/40'
              }`}
          >
            ตั๋วช่วยเหลือ / แจ้งปัญหา ({adminTickets.length})
          </button>

          <button
            onClick={() => setActiveTab('point-shop')}
            className={`px-5 py-2.5 rounded-xl text-xs font-semibold whitespace-nowrap border transition-all cursor-pointer duration-300 ${activeTab === 'point-shop'
                ? 'bg-amber-500/10 text-amber-400 border-amber-500/30 shadow-[0_0_15px_rgba(245,158,11,0.15)] font-bold'
                : 'bg-zinc-950/20 border-white/5 text-zinc-400 hover:text-white hover:border-white/10 hover:bg-zinc-900/40'
              }`}
          >
            จัดการ Point Shop ({adminPointShopData.items?.length || 0})
          </button>

          <button
            onClick={() => setActiveTab('topup')}
            className={`px-5 py-2.5 rounded-xl text-xs font-semibold whitespace-nowrap border transition-all cursor-pointer duration-300 ${activeTab === 'topup'
                ? 'bg-sky-500/10 text-sky-400 border-sky-500/30 shadow-[0_0_15px_rgba(14,165,233,0.15)] font-bold'
                : 'bg-zinc-950/20 border-white/5 text-zinc-400 hover:text-white hover:border-white/10 hover:bg-zinc-900/40'
              }`}
          >
            ตั้งค่าระบบเติมเงิน
          </button>
        </div>

        {/* TAB 1: MANAGE PRODUCTS */}
        {activeTab === 'products' && (
          <div className="space-y-4 animate-in fade-in-50 duration-200">
            <div className="flex justify-between items-center bg-white/5 border border-white/5 p-4 rounded-2xl">
              <div>
                <h3 className="text-sm font-bold text-white font-bold">รายการคลังสินค้า</h3>
                <p className="text-[11px] text-zinc-500">จัดการข้อมูล เพิ่ม แก้ไข หรือลบสินค้าในระบบ NakataShop</p>
              </div>

              <button
                onClick={handleAddProduct}
                className="flex items-center gap-1.5 text-xs font-bold bg-sky-500 text-sky-950 hover:bg-sky-400 px-4 py-2.5 rounded-xl transition-all cursor-pointer glow-btn"
              >
                <Plus className="w-4 h-4" />
                <span>เพิ่มสินค้าใหม่</span>
              </button>
            </div>

            {productsLoading ? (
              <div className="text-center py-20 text-xs text-zinc-500 flex flex-col items-center gap-3">
                <Loader2 className="w-8 h-8 animate-spin text-sky-400" />
                <span>กำลังโหลดข้อมูลสินค้า...</span>
              </div>
            ) : (
              <div className="overflow-x-auto border border-white/5 rounded-2xl bg-zinc-950/20 backdrop-blur-md">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-white/10 bg-zinc-950/60 text-zinc-200 font-bold uppercase tracking-wider backdrop-blur-sm">
                      <th className="p-4">รูปภาพ</th>
                      <th className="p-4">ชื่อสินค้า</th>
                      <th className="p-4">หมวดหมู่</th>
                      <th className="p-4">ราคา</th>
                      <th className="p-4">คลังคงเหลือ</th>
                      <th className="p-4">ขายสะสม</th>
                      <th className="p-4 text-right">ดำเนินการ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 text-zinc-300">
                    {products.map((p) => (
                      <tr key={p._id} className="hover:bg-white/5 transition-colors">
                        <td className="p-4">
                          <img src={p.image} alt={p.name} className="w-12 h-12 object-cover rounded-lg border border-white/5 bg-zinc-900" />
                        </td>
                        <td className="p-4 font-semibold text-white max-w-[200px] truncate">{p.name}</td>
                        <td className="p-4">
                          <span className="text-[10px] font-semibold px-2 py-0.5 bg-sky-500/10 border border-sky-500/10 text-sky-400 rounded">
                            {p.subcategory}
                          </span>
                        </td>
                        <td className="p-4 font-bold text-sky-400">{p.price.toLocaleString()} THB</td>
                        <td className="p-4 font-semibold">{p.stock} ชิ้น</td>
                        <td className="p-4 text-zinc-400">{p.sold} ชิ้น</td>
                        <td className="p-4 text-right whitespace-nowrap space-x-2">
                          {p.stockType === 'code' && (
                            <button
                              onClick={() => {
                                setSelectedProductForStock(p);
                                setStockModalOpen(true);
                              }}
                              className="inline-flex items-center gap-1 bg-zinc-900 text-sky-400 hover:text-sky-300 border border-white/5 hover:border-sky-500/20 px-2.5 py-1.5 rounded-lg cursor-pointer transition-colors"
                              title="จัดการคีย์/รหัสสต็อกสินค้า"
                            >
                              <Key className="w-3.5 h-3.5" />
                              <span className="text-[10px] font-bold">เติมสต็อก</span>
                            </button>
                          )}
                          <button
                            onClick={() => handleEditProduct(p)}
                            className="inline-flex items-center gap-1 bg-zinc-900 text-sky-400 hover:text-sky-300 border border-white/5 hover:border-sky-500/20 p-2 rounded-lg cursor-pointer"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteProduct(p._id, p.name)}
                            className="inline-flex items-center gap-1 bg-zinc-900 text-red-400 hover:text-red-300 border border-white/5 hover:border-red-500/20 p-2 rounded-lg cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: MANAGE USERS */}
        {activeTab === 'users' && (
          <div className="space-y-4 animate-in fade-in-50 duration-200">
            {/* Header / Search Controls */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white/5 border border-white/5 p-4 rounded-2xl">
              <div>
                <h3 className="text-sm font-bold text-white font-bold">บัญชีผู้ใช้งานในระบบ</h3>
                <p className="text-[11px] text-zinc-500">ปรับยอดเงิน สิทธิ์ แนะนำยอดใช้สะสมและสัญลักษณ์ยศสมาชิก (VIP Rank)</p>
              </div>

              {/* Search input */}
              <div className="relative max-w-xs w-full">
                <input
                  type="text"
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  placeholder="ค้นหาชื่อ หรือ อีเมลผู้ใช้..."
                  className="w-full bg-[#03060d] border border-white/10 px-4 py-2.5 rounded-xl text-xs text-white placeholder-zinc-500 focus-glow transition-all duration-300"
                />
              </div>
            </div>

            {/* Users list table */}
            {usersLoading ? (
              <div className="text-center py-20 text-xs text-zinc-500 flex flex-col items-center gap-3">
                <Loader2 className="w-8 h-8 animate-spin text-sky-400" />
                <span>กำลังโหลดข้อมูลผู้ใช้...</span>
              </div>
            ) : (
              <div className="overflow-x-auto border border-white/5 rounded-2xl bg-zinc-950/20 backdrop-blur-md">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-white/10 bg-zinc-950/60 text-zinc-200 font-bold uppercase tracking-wider backdrop-blur-sm font-sans">
                      <th className="p-4">ชื่อผู้ใช้</th>
                      <th className="p-4">อีเมล</th>
                      <th className="p-4">ยอดเงินในกระเป๋า</th>
                      <th className="p-4">แต้มสะสมพอยท์</th>
                      <th className="p-4">ยอดซื้อสะสม / ยศ VIP</th>
                      <th className="p-4">บทบาท (Role)</th>
                      <th className="p-4">วันที่สมัคร</th>
                      <th className="p-4 text-right">ดำเนินการ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 text-zinc-300">
                    {users.map((u) => {
                      const uRank = getUserRank(u.totalSpent || 0);

                      return (
                        <tr key={u._id} className="hover:bg-white/5 transition-colors">
                          <td className="p-4 font-semibold text-white">{u.username}</td>
                          <td className="p-4">{u.email}</td>
                          <td className="p-4 font-bold text-sky-400">{u.balance?.toLocaleString()} THB</td>
                          <td className="p-4 font-bold text-amber-400 font-mono">{(u.points || 0).toLocaleString()} P</td>
                          <td className="p-4">
                            <span className="font-semibold text-zinc-300">{(u.totalSpent || 0).toLocaleString()} THB</span>
                            <span className={`inline-flex items-center text-[9px] font-black px-2 py-0.5 rounded border tracking-wider ml-2 select-none ${uRank.color}`}>
                              {uRank.badge}
                            </span>
                          </td>
                          <td className="p-4">
                            <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${u.role === 'admin'
                                ? 'bg-amber-500/10 border-amber-500/25 text-amber-400'
                                : 'bg-zinc-800 border-zinc-700 text-zinc-400'
                              }`}>
                              {u.role === 'admin' ? <ShieldAlert className="w-3 h-3" /> : <User className="w-3 h-3" />}
                              {u.role === 'admin' ? 'ผู้ดูแลระบบ (Admin)' : 'ลูกค้า (User)'}
                            </span>
                          </td>
                          <td className="p-4 text-zinc-500">
                            {new Date(u.createdAt).toLocaleDateString('th-TH', { dateStyle: 'medium' })}
                          </td>
                          <td className="p-4 text-right whitespace-nowrap space-x-2">
                            <button
                              onClick={() => {
                                setSelectedUserForAdjust(u);
                                setAdjustAmount('');
                                setAdjustReason('');
                                setAdjustSpent(String(u.totalSpent || 0));
                                setAdjustError('');
                              }}
                              className="inline-flex items-center gap-1 bg-zinc-900 text-sky-400 hover:text-sky-300 border border-white/5 hover:border-sky-500/20 px-2.5 py-1.5 rounded-lg cursor-pointer transition-colors"
                              title="ปรับแต่งเงิน / จัดการยศสมาชิก"
                            >
                              <DollarSign className="w-3.5 h-3.5" />
                              <span>ปรับเงิน/ยศ</span>
                            </button>

                            <button
                              onClick={() => {
                                if (u._id === session.user.id) {
                                  alert('ไม่สามารถเปลี่ยนสิทธิ์บัญชีของตัวเองได้');
                                  return;
                                }
                                const targetRole = u.role === 'admin' ? 'user' : 'admin';
                                if (window.confirm(`ต้องการเปลี่ยนสิทธิ์ของ "${u.username}" เป็น ${targetRole === 'admin' ? 'แอดมิน' : 'ลูกค้า'} หรือไม่?`)) {
                                  updateUserMutation.mutate({ userId: u._id, role: targetRole });
                                }
                              }}
                              className="inline-flex items-center gap-1 bg-zinc-900 text-amber-400 hover:text-amber-300 border border-white/5 hover:border-amber-500/20 px-2.5 py-1.5 rounded-lg cursor-pointer transition-colors"
                              title="สลับบทบาท"
                            >
                              <Shield className="w-3.5 h-3.5" />
                              <span>สิทธิ์</span>
                            </button>

                            <button
                              disabled={u._id === session.user.id}
                              onClick={() => {
                                if (window.confirm(`คุณแน่ใจว่าต้องการลบผู้ใช้ "${u.username}" และทรานแซกชั่นของเขาออกทั้งหมด? การกระทำนี้ไม่สามารถย้อนคืนได้!`)) {
                                  deleteUserMutation.mutate(u._id);
                                }
                              }}
                              className="inline-flex items-center gap-1 bg-zinc-900 text-red-400 hover:text-red-300 border border-white/5 hover:border-red-500/20 p-2 rounded-lg cursor-pointer disabled:opacity-40 disabled:pointer-events-none transition-colors"
                              title="ลบบัญชี"
                            >
                              <Trash className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: MANAGE COUPONS */}
        {activeTab === 'coupons' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in-50 duration-200">
            {/* Left col: Add new coupon */}
            <div className="space-y-4">
              <div className="glass p-5 rounded-2xl border border-white/5 space-y-4">
                <h3 className="text-sm font-bold text-white font-bold flex items-center gap-2">
                  <Tag className="w-4 h-4 text-sky-400" />
                  <span>สร้างคูปองส่วนลดใหม่</span>
                </h3>

                {couponError && (
                  <div className="bg-red-500/10 border border-red-500/20 px-3 py-2 rounded-lg text-xs text-red-400 flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{couponError}</span>
                  </div>
                )}

                <form onSubmit={handleCreateCoupon} className="space-y-3.5">
                  <div className="space-y-1">
                    <label className="text-[11px] text-zinc-400 font-semibold">รหัสคูปอง (Coupon Code) *</label>
                    <input
                      type="text"
                      required
                      value={couponCode}
                      onChange={(e) => setCouponCode(e.target.value)}
                      className="w-full bg-[#03060d] border border-white/10 px-4 py-2.5 rounded-xl text-xs text-white placeholder-zinc-500 uppercase focus-glow transition-all duration-300"
                      placeholder="เช่น NAKATA50"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] text-zinc-400 font-semibold">ประเภทส่วนลด *</label>
                    <select
                      value={couponType}
                      onChange={(e) => setCouponType(e.target.value)}
                      className="w-full bg-[#03060d] border border-white/10 px-4 py-2.5 rounded-xl text-xs text-white placeholder-zinc-500 focus-glow transition-all duration-300 font-sans"
                    >
                      <option value="fixed">จำนวนเงินคงที่ (บาท)</option>
                      <option value="percentage">เปอร์เซ็นต์ส่วนลด (%)</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] text-zinc-400 font-semibold">
                      {couponType === 'percentage' ? 'ส่วนลด (%) *' : 'ส่วนลด (บาท) *'}
                    </label>
                    <input
                      type="number"
                      required
                      min="0"
                      max={couponType === 'percentage' ? '100' : undefined}
                      value={couponDiscount}
                      onChange={(e) => setCouponDiscount(e.target.value)}
                      className="w-full bg-[#03060d] border border-white/10 px-4 py-2.5 rounded-xl text-xs text-white placeholder-zinc-500 focus-glow transition-all duration-300"
                      placeholder={couponType === 'percentage' ? "เช่น 10 (ลด 10%)" : "เช่น 50 (ลด 50 บาท)"}
                    />
                  </div>

                  {couponType === 'percentage' && (
                    <div className="space-y-1">
                      <label className="text-[11px] text-zinc-400 font-semibold">ลดสูงสุดไม่เกิน (บาท - ระบุหรือไม่ก็ได้)</label>
                      <input
                        type="number"
                        min="0"
                        value={couponMaxDiscount}
                        onChange={(e) => setCouponMaxDiscount(e.target.value)}
                        className="w-full bg-[#03060d] border border-white/10 px-4 py-2.5 rounded-xl text-xs text-white placeholder-zinc-500 focus-glow transition-all duration-300"
                        placeholder="เช่น 100 (หากเว้นว่างไว้จะลดเต็มจำนวน %)"
                      />
                    </div>
                  )}

                  <div className="space-y-1">
                    <label className="text-[11px] text-zinc-400 font-semibold">ยอดซื้อขั้นต่ำสำหรับการใช้งาน (บาท)</label>
                    <input
                      type="number"
                      min="0"
                      value={couponMinPurchase}
                      onChange={(e) => setCouponMinPurchase(e.target.value)}
                      className="w-full bg-[#03060d] border border-white/10 px-4 py-2.5 rounded-xl text-xs text-white placeholder-zinc-500 focus-glow transition-all duration-300"
                      placeholder="เช่น 200 (หากเว้นว่างหรือ 0 จะใช้ได้ทันที)"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] text-zinc-400 font-semibold">วันหมดอายุ (ระบุหรือไม่ก็ได้)</label>
                    <input
                      type="datetime-local"
                      value={couponExpiresAt}
                      onChange={(e) => setCouponExpiresAt(e.target.value)}
                      className="w-full bg-[#03060d] border border-white/10 px-4 py-2.5 rounded-xl text-xs text-white placeholder-zinc-500 focus-glow transition-all duration-300 font-sans"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] text-zinc-400 font-semibold">สิทธิ์ใช้งานต่อ 1 บัญชีผู้ใช้ (ครั้ง) *</label>
                    <input
                      type="number"
                      required
                      min="1"
                      value={couponMaxUsesPerUser}
                      onChange={(e) => setCouponMaxUsesPerUser(e.target.value)}
                      className="w-full bg-[#03060d] border border-white/10 px-4 py-2.5 rounded-xl text-xs text-white placeholder-zinc-500 focus-glow transition-all duration-300"
                      placeholder="เช่น 1 (สิทธิ์คนละ 1 ครั้ง)"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={createCouponMutation.isPending}
                    className="w-full flex items-center justify-center gap-1.5 bg-sky-500 text-sky-950 font-bold py-2.5 rounded-xl hover:bg-sky-400 transition-all text-xs glow-btn cursor-pointer"
                  >
                    {createCouponMutation.isPending ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <>
                        <Plus className="w-3.5 h-3.5" />
                        <span>สร้างคูปองโค้ด</span>
                      </>
                    )}
                  </button>
                </form>
              </div>
            </div>

            {/* Right col: Coupons lists table */}
            <div className="lg:col-span-2 space-y-4">
              <div className="bg-white/5 border border-white/5 p-4 rounded-2xl">
                <h3 className="text-sm font-bold text-white font-bold">ประวัติโค้ดคูปองในระบบ</h3>
                <p className="text-[11px] text-zinc-500">เปิด-ปิดการใช้งานคูปองชั่วคราว หรือลบคูปองออกถาวร</p>
              </div>

              {couponsLoading ? (
                <div className="text-center py-10 text-xs text-zinc-500 flex flex-col items-center gap-2">
                  <Loader2 className="w-6 h-6 animate-spin text-sky-400" />
                  <span>กำลังโหลดข้อมูลคูปอง...</span>
                </div>
              ) : coupons.length === 0 ? (
                <div className="glass p-12 text-center text-xs text-zinc-500 rounded-xl border border-white/5">
                  ยังไม่มีคูปองส่วนลดในระบบ
                </div>
              ) : (
                <div className="overflow-x-auto border border-white/5 rounded-2xl bg-zinc-950/20 backdrop-blur-md">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-white/10 bg-zinc-950/60 text-zinc-200 font-bold uppercase tracking-wider backdrop-blur-sm font-sans">
                        <th className="p-4">รหัสคูปอง</th>
                        <th className="p-4">ประเภท/มูลค่าส่วนลด</th>
                        <th className="p-4">เงื่อนไข/สิทธิ์</th>
                        <th className="p-4">วันหมดอายุ</th>
                        <th className="p-4">สถานะ</th>
                        <th className="p-4 text-right">ดำเนินการ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 text-zinc-300">
                      {coupons.map((c) => (
                        <tr key={c._id} className="hover:bg-white/5 transition-colors">
                          <td className="p-4 font-mono font-bold text-white tracking-wider">{c.code}</td>
                          <td className="p-4 font-bold text-emerald-400">
                            {c.type === 'percentage' ? (
                              <span>ลด {c.discount}% {c.maxDiscount ? `(สูงสุด ${c.maxDiscount} THB)` : ''}</span>
                            ) : (
                              <span>ลด {c.discount?.toLocaleString()} THB</span>
                            )}
                          </td>
                          <td className="p-4 text-[10px] text-zinc-400 font-sans space-y-0.5">
                            <div>ซื้อขั้นต่ำ: <span className="text-white font-semibold">{c.minPurchase || 0} บาท</span></div>
                            <div>สิทธิ์ต่อคน: <span className="text-white font-semibold">{c.maxUsesPerUser || 1} ครั้ง</span></div>
                          </td>
                          <td className="p-4 font-mono text-[10px] text-zinc-400">
                            {c.expiresAt ? (
                              <span className={new Date(c.expiresAt) < new Date() ? 'text-red-400 font-bold' : ''}>
                                {new Date(c.expiresAt).toLocaleString('th-TH')}
                              </span>
                            ) : (
                              <span className="text-zinc-600">ไม่มีกำหนด</span>
                            )}
                          </td>
                          <td className="p-4">
                            <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded border ${c.isActive && (!c.expiresAt || new Date(c.expiresAt) > new Date())
                                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                                : 'bg-red-500/10 border-red-500/20 text-red-400'
                              }`}>
                              {!c.isActive ? 'ปิดใช้งาน' : (c.expiresAt && new Date(c.expiresAt) < new Date() ? 'หมดอายุ' : 'เปิดใช้งาน')}
                            </span>
                          </td>
                          <td className="p-4 text-right whitespace-nowrap space-x-2">
                            <button
                              onClick={() => toggleCouponMutation.mutate({ id: c._id, isActive: !c.isActive })}
                              className={`inline-flex items-center gap-1 border p-1.5 rounded-lg cursor-pointer transition-colors ${c.isActive
                                  ? 'bg-zinc-900 border-white/5 text-red-400 hover:border-red-500/20 hover:text-red-300'
                                  : 'bg-zinc-900 border-white/5 text-emerald-400 hover:border-emerald-500/20 hover:text-emerald-300'
                                }`}
                              title={c.isActive ? 'ปิดการใช้โค้ด' : 'เปิดการใช้โค้ด'}
                            >
                              <Power className="w-3.5 h-3.5" />
                            </button>

                            <button
                              onClick={() => {
                                if (window.confirm(`คุณต้องการลบคูปอง "${c.code}" หรือไม่?`)) {
                                  deleteCouponMutation.mutate(c._id);
                                }
                              }}
                              className="inline-flex items-center gap-1 bg-zinc-900 text-zinc-400 hover:text-red-400 border border-white/5 hover:border-red-500/20 p-1.5 rounded-lg cursor-pointer transition-colors"
                              title="ลบคูปอง"
                            >
                              <Trash className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 4: MANAGE GACHA WHEEL */}
        {activeTab === 'gacha' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in-50 duration-200">
<div className="lg:col-span-3">
              <AdminGachaTierManager
                tiers={displayGachaTiers}
                selectedTierId={selectedGachaTier?.id}
                onSelect={tier => setSelectedGachaTierId(tier.id)}
                onCreate={payload => createGachaTierMutation.mutate(payload)}
                onUpdate={payload => updateGachaTierMutation.mutate(payload)}
                onDelete={tier => { if (window.confirm('Delete tier ' + tier.name + '?')) deleteGachaTierMutation.mutate(tier); }}
              />
              {gachaTiersLoading && <p className="text-xs text-zinc-500 mt-2">Loading tiers...</p>}
            </div>
            {/* Left col: Add new prize */}
            <div className="space-y-4">
              <div className="glass p-5 rounded-2xl border border-white/5 space-y-4">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Award className="w-4 h-4 text-sky-400" />
                  <span>สร้างรางวัลสุ่มใหม่ (Gacha Item)</span>
                </h3>

                {gachaError && (
                  <div className="bg-red-500/10 border border-red-500/20 px-3 py-2 rounded-lg text-xs text-red-400 flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{gachaError}</span>
                  </div>
                )}

                <form onSubmit={handleCreateGachaItem} className="space-y-3.5">
                  <div className="space-y-1">
                    <label className="text-[11px] text-zinc-400 font-semibold block">ชื่อของรางวัล *</label>
                    <input
                      type="text"
                      required
                      value={gachaName}
                      onChange={(e) => setGachaName(e.target.value)}
                      className="w-full bg-[#03060d] border border-white/10 px-4 py-2.5 rounded-xl text-xs text-white placeholder-zinc-500 focus-glow transition-all duration-300"
                      placeholder="เช่น Steam Wallet 200 บาท หรือ เกลือ"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] text-zinc-400 font-semibold block">ประเภทของรางวัล *</label>
                    <select
                      value={gachaType}
                      onChange={(e) => setGachaType(e.target.value)}
                      className="w-full bg-[#03060d] border border-white/10 px-4 py-2.5 rounded-xl text-xs text-white focus-glow transition-all duration-300"
                    >
                      <option value="empty">เกลือ (ไม่ได้รางวัล)</option>
                      <option value="coupon">คูปองส่วนลดในร้านค้า</option>
                      <option value="code">แจกโค้ดคีย์/รหัสผ่านจริง</option>
                      <option value="topup">โค้ดเติมเงินเข้าเว็บ (เครดิต)</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] text-zinc-400 font-semibold block">เปอร์เซ็นต์รางวัล (%) *</label>
                    <input
                      type="number"
                      required
                      min="0" step="0.01"
                      value={gachaChance}
                      onChange={(e) => setGachaChance(e.target.value)}
                      className="w-full bg-[#03060d] border border-white/10 px-4 py-2.5 rounded-xl text-xs text-white placeholder-zinc-500 focus-glow transition-all duration-300"
                      placeholder="เช่น 10 (ค่ายิ่งสูงยิ่งออกง่าย)"
                    />
                  </div>

                  {gachaType === 'coupon' && (
                    <div className="space-y-1">
                      <label className="text-[11px] text-zinc-400 font-semibold block">มูลค่าส่วนลดคูปอง (บาท) *</label>
                      <input
                        type="number"
                        required
                        min="1"
                        value={gachaDiscount}
                        onChange={(e) => setGachaDiscount(e.target.value)}
                        className="w-full bg-[#03060d] border border-white/10 px-4 py-2.5 rounded-xl text-xs text-white placeholder-zinc-500 focus-glow transition-all duration-300"
                        placeholder="เช่น 30"
                      />
                    </div>
                  )}

                  {gachaType === 'topup' && (
                    <div className="space-y-1">
                      <label className="text-[11px] text-zinc-400 font-semibold block">ยอดเงินเติมเข้าเว็บ (บาท) *</label>
                      <input
                        type="number"
                        required
                        min="1"
                        value={gachaTopupAmount}
                        onChange={(e) => setGachaTopupAmount(e.target.value)}
                        className="w-full bg-[#03060d] border border-white/10 px-4 py-2.5 rounded-xl text-xs text-white placeholder-zinc-500 focus-glow transition-all duration-300"
                        placeholder="เช่น 50"
                      />
                    </div>
                  )}

                  {gachaType === 'code' && (
                    <div className="space-y-1">
                      <label className="text-[11px] text-zinc-400 font-semibold block">
                        รหัสสต็อกคีย์เริ่มต้น (1 รหัสต่อบรรทัด)
                      </label>
                      <textarea
                        value={gachaStock}
                        onChange={(e) => setGachaStock(e.target.value)}
                        rows="4"
                        className="w-full bg-[#03060d] border border-white/10 px-4 py-2.5 rounded-xl text-xs text-white placeholder-zinc-500 font-mono focus-glow transition-all duration-300 resize-none"
                        placeholder={`KEY-XXXX-1111\nKEY-YYYY-2222`}
                      />
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={createGachaItemMutation.isPending}
                    className="w-full flex items-center justify-center gap-1.5 bg-sky-500 text-sky-950 font-bold py-2.5 rounded-xl hover:bg-sky-400 transition-all text-xs glow-btn cursor-pointer"
                  >
                    {createGachaItemMutation.isPending ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <>
                        <Plus className="w-3.5 h-3.5" />
                        <span>เพิ่มเข้าวงล้อ Gacha</span>
                      </>
                    )}
                  </button>
                </form>
              </div>
            </div>

            {/* Right col: Gacha Slices List */}
            <div className="lg:col-span-2 space-y-4">
              <div className="bg-white/5 border border-white/5 p-4 rounded-2xl">
                <h3 className="text-sm font-bold text-white">รายชื่อของรางวัลบนวงล้อสุ่ม</h3>
                <p className="text-[11px] text-zinc-500">
                  ควบคุมสัดส่วนอัตราสุ่ม แก้ไขรางวัล/เปอร์เซ็นต์ เติมโค้ด และแสดงเปอร์เซ็นต์สุ่ม (%) จริง 2 ตำแหน่ง
                </p>
              </div>

              {gachaLoading ? (
                <div className="text-center py-10 text-xs text-zinc-500 flex flex-col items-center gap-2">
                  <Loader2 className="w-6 h-6 animate-spin text-sky-400" />
                  <span>กำลังโหลดรายการ Gacha...</span>
                </div>
              ) : gachaItems.length === 0 ? (
                <div className="glass p-12 text-center text-xs text-zinc-500 rounded-xl border border-white/5">
                  ยังไม่มีของรางวัลบนวงล้อนำโชค
                </div>
              ) : (
                <div className="overflow-x-auto border border-white/5 rounded-2xl bg-zinc-950/20 backdrop-blur-md">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-white/10 bg-zinc-950/60 text-zinc-200 font-bold uppercase tracking-wider backdrop-blur-sm">
                        <th className="p-4">ของรางวัล</th>
                        <th className="p-4">ประเภท</th>
                        <th className="p-4">อัตราการออก (Weight / %)</th>
                        <th className="p-4">คลังสต็อกคงเหลือ</th>
                        <th className="p-4 text-right">ดำเนินการ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 text-zinc-300">
                      {gachaItems.map((item) => {
                        const totalCodes = item.stock?.length || 0;
                        const usedCodesCount = item.usedCodes?.length || 0;
                        const percentChance = Number(item.chance).toFixed(2);

                        return (
                          <tr key={item._id} className="hover:bg-white/5 transition-colors">
                            <td className="p-4">
                              <span className="font-semibold text-white block">{item.name}</span>
                              {item.type === 'coupon' && (
                                <span className="text-[10px] text-emerald-400">สร้างส่วนลด {item.couponDiscount} THB</span>
                              )}
                              {item.type === 'topup' && (
                                <span className="text-[10px] text-sky-400">สร้างโค้ดเติมเงิน {item.topupAmount} THB</span>
                              )}
                            </td>
                            <td className="p-4">
                              <span className={`inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded border ${item.type === 'code'
                                  ? 'bg-sky-500/10 border-sky-500/20 text-sky-400'
                                  : item.type === 'coupon'
                                    ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                                    : item.type === 'topup'
                                      ? 'bg-sky-500/10 border-sky-500/20 text-sky-400'
                                      : 'bg-zinc-800 border-zinc-700 text-zinc-400'
                                }`}>
                                {item.type === 'code' ? 'คีย์โค้ด/ไอดี' : item.type === 'coupon' ? 'คูปองลดเงิน' : item.type === 'topup' ? 'โค้ดเติมเงิน' : 'เกลือ'}
                              </span>
                            </td>
                            <td className="p-4 font-bold text-amber-400">
                              <span>เปอร์เซ็นต์: {item.chance}% </span>
                              <span className="text-[10px] text-zinc-500 font-normal">
                                (กำหนดไว้ {percentChance}%)
                              </span>
                            </td>
                            <td className="p-4 font-mono">
                              {item.type === 'code' ? (
                                <span className={totalCodes === 0 ? 'text-red-400' : 'text-zinc-300'}>
                                  คีย์พร้อมแจก: {totalCodes} ชิ้น (แจกแล้ว {usedCodesCount})
                                </span>
                              ) : item.type === 'coupon' ? (
                                <span className="text-zinc-500">สุ่มเจเนอเรตได้ไม่จำกัด</span>
                              ) : item.type === 'topup' ? (
                                <span className="text-zinc-500">สุ่มเจเนอเรตได้ไม่จำกัด</span>
                              ) : (
                                <span className="text-zinc-500">-</span>
                              )}
                            </td>
                             <td className="p-4 text-right whitespace-nowrap space-x-2">
                              {item.type === 'code' && (
                                <button
                                  onClick={() => {
                                    setSelectedGachaForStockManagement(item);
                                    setGachaStockModalOpen(true);
                                  }}
                                  className="inline-flex items-center gap-1 bg-zinc-900 text-sky-400 hover:text-sky-300 border border-white/5 hover:border-sky-500/20 px-2.5 py-1.5 rounded-lg cursor-pointer transition-colors"
                                  title="จัดการรหัสสต็อกคีย์"
                                >
                                  <Key className="w-3.5 h-3.5" />
                                  <span>จัดการคีย์</span>
                                </button>
                              )}

                              <button
                                onClick={() => {
                                  setSelectedGachaToEdit(item);
                                  setEditGachaName(item.name);
                                  setEditGachaChance(String(item.chance));
                                  setEditGachaDiscount(item.couponDiscount ? String(item.couponDiscount) : '');
                                  setEditGachaTopupAmount(item.topupAmount ? String(item.topupAmount) : '');
                                  setEditGachaError('');
                                }}
                                className="inline-flex items-center gap-1 bg-zinc-900 text-sky-400 hover:text-sky-300 border border-white/5 hover:border-sky-500/20 p-1.5 rounded-lg cursor-pointer transition-colors"
                                title="แก้ไขของรางวัลและเรต"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>

                              <button
                                onClick={() => {
                                  if (window.confirm(`ต้องการลบของรางวัล "${item.name}" ออกจากวงล้อ Gacha?`)) {
                                    deleteGachaItemMutation.mutate(item._id);
                                  }
                                }}
                                className="inline-flex items-center gap-1 bg-zinc-900 text-red-400 hover:text-red-300 border border-white/5 hover:border-red-500/20 p-1.5 rounded-lg cursor-pointer transition-colors"
                                title="ลบรางวัล"
                              >
                                <Trash className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 5: SYSTEM TRANSACTIONS */}
        {activeTab === 'transactions' && (
          <div className="space-y-4 animate-in fade-in-50 duration-200">
            <div className="bg-white/5 border border-white/5 p-4 rounded-2xl">
              <h3 className="text-sm font-bold text-white">บันทึกธุรกรรมทั้งหมดของ NakataShop</h3>
              <p className="text-[11px] text-zinc-500">
                รายการซื้อของลูกค้าและรายการประวัติเติมเงินสะสมในระบบ คัดกรองย้อนหลัง 100 รายการล่าสุด
              </p>
            </div>

            {transactionsLoading ? (
              <div className="text-center py-20 text-xs text-zinc-500 flex flex-col items-center gap-3">
                <Loader2 className="w-8 h-8 animate-spin text-sky-400" />
                <span>กำลังดึงทรานแซกชั่นทั้งหมด...</span>
              </div>
            ) : (
              <div className="overflow-x-auto border border-white/5 rounded-2xl bg-zinc-950/20 backdrop-blur-md">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-white/10 bg-zinc-950/60 text-zinc-200 font-bold uppercase tracking-wider backdrop-blur-sm">
                      <th className="p-4">ประเภท</th>
                      <th className="p-4">ผู้ใช้งาน (User)</th>
                      <th className="p-4">รายละเอียด</th>
                      <th className="p-4">ยอดเงิน</th>
                      <th className="p-4">วันเวลาทำรายการ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 text-zinc-300">
                    {allTransactions.map((tx) => {
                      const isPurchase = tx.type === 'purchase';
                      const isAdjustment = tx.description.includes('[ปรับยอดเงินโดยแอดมิน]');
                      const isGacha = tx.description.includes('[สุ่มวงล้อ Gacha]');
                      const walletMethod = isAdjustment ? 'ปรับเงิน' : tx.description.includes('PromptPay') ? 'PromptPay' : tx.description.includes('Wallet') ? 'Wallet' : 'Cashcard';
                      const displayDate = new Date(tx.createdAt).toLocaleString('th-TH', {
                        dateStyle: 'medium',
                        timeStyle: 'short'
                      });

                      return (
                        <tr key={tx._id} className="hover:bg-white/5 transition-colors">
                          <td className="p-4">
                            <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded border ${isAdjustment
                                ? 'bg-amber-500/10 border-amber-500/10 text-amber-400'
                                : isGacha
                                  ? 'bg-purple-500/10 border-purple-500/10 text-purple-400'
                                  : isPurchase
                                    ? 'bg-red-500/10 border-red-500/10 text-red-400'
                                    : 'bg-emerald-500/10 border-emerald-500/10 text-emerald-400'
                              }`}>
                              {isAdjustment ? (
                                <>
                                  <Sliders className="w-3 h-3" />
                                  <span>ปรับเงินระบบ</span>
                                </>
                              ) : isGacha ? (
                                <>
                                  <Award className="w-3 h-3" />
                                  <span>วงล้อสุ่ม</span>
                                </>
                              ) : isPurchase ? (
                                <>
                                  <ShoppingCart className="w-3 h-3" />
                                  <span>ซื้อสินค้า</span>
                                </>
                              ) : (
                                <>
                                  <Landmark className="w-3 h-3" />
                                  <span>เติมเงิน ({walletMethod})</span>
                                </>
                              )}
                            </span>
                          </td>
                          <td className="p-4">
                            {tx.user ? (
                              <div>
                                <span className="font-semibold text-white block">{tx.user.username}</span>
                                <span className="text-[10px] text-zinc-500">{tx.user.email}</span>
                              </div>
                            ) : (
                              <span className="text-zinc-600">ไม่มีข้อมูลผู้ใช้</span>
                            )}
                          </td>
                          <td className="p-4 max-w-[280px] whitespace-pre-line leading-relaxed text-zinc-300">
                            {tx.description}
                          </td>
                          <td className="p-4 font-bold">
                            <span className={tx.amount < 0 ? 'text-red-400' : 'text-emerald-400'}>
                              {tx.amount > 0 ? '+' : ''}
                              {tx.amount.toLocaleString()} THB
                            </span>
                          </td>
                          <td className="p-4 text-zinc-500">{displayDate}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB 6: STATS DASHBOARD SUMMARY */}
        {activeTab === 'stats' && (
          <div className="space-y-6 animate-in fade-in-50 duration-200">
            {/* Primary stats grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Card 1: Revenue */}
              <div className="bg-gradient-to-br from-emerald-500/5 via-zinc-950/40 to-transparent p-5 rounded-2xl border border-emerald-500/10 flex items-center gap-4 hover:border-emerald-500/20 hover:-translate-y-1 transition-all duration-300 shadow-[0_4px_20px_rgba(0,0,0,0.3)] hover:shadow-emerald-500/5 cursor-pointer">
                <div className="bg-emerald-500/10 p-3 rounded-xl text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.1)]">
                  <DollarSign className="w-6 h-6 animate-pulse" />
                </div>
                <div>
                  <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider">รายได้รวมทั้งหมด</span>
                  <h3 className="text-xl sm:text-2xl font-black text-emerald-400 mt-0.5">
                    {statsLoading ? <span className="inline-block w-16 h-6 skeleton-pulse rounded" /> : `${stats?.totalRevenue?.toLocaleString()} THB`}
                  </h3>
                </div>
              </div>

              {/* Card 2: Total Topups */}
              <div className="bg-gradient-to-br from-sky-500/5 via-zinc-950/40 to-transparent p-5 rounded-2xl border border-sky-500/10 flex items-center gap-4 hover:border-sky-500/20 hover:-translate-y-1 transition-all duration-300 shadow-[0_4px_20px_rgba(0,0,0,0.3)] hover:shadow-sky-500/5 cursor-pointer">
                <div className="bg-sky-500/10 p-3 rounded-xl text-sky-400 shadow-[0_0_15px_rgba(14,165,233,0.1)]">
                  <Landmark className="w-6 h-6" />
                </div>
                <div>
                  <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider">ยอดเงินเติมเข้าระบบ</span>
                  <h3 className="text-xl sm:text-2xl font-black text-sky-400 mt-0.5">
                    {statsLoading ? <span className="inline-block w-16 h-6 skeleton-pulse rounded" /> : `${stats?.totalTopups?.toLocaleString()} THB`}
                  </h3>
                </div>
              </div>

              {/* Card 3: Total Users */}
              <div className="bg-gradient-to-br from-amber-500/5 via-zinc-950/40 to-transparent p-5 rounded-2xl border border-amber-500/10 flex items-center gap-4 hover:border-amber-500/20 hover:-translate-y-1 transition-all duration-300 shadow-[0_4px_20px_rgba(0,0,0,0.3)] hover:shadow-amber-500/5 cursor-pointer">
                <div className="bg-amber-500/10 p-3 rounded-xl text-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.1)]">
                  <Users className="w-6 h-6" />
                </div>
                <div>
                  <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider">สมาชิกทั้งหมด</span>
                  <h3 className="text-xl sm:text-2xl font-black text-white mt-0.5">
                    {statsLoading ? <span className="inline-block w-16 h-6 skeleton-pulse rounded" /> : `${stats?.users?.toLocaleString()} คน`}
                  </h3>
                </div>
              </div>

              {/* Card 4: Pending Tickets */}
              <div className="bg-gradient-to-br from-red-500/5 via-zinc-950/40 to-transparent p-5 rounded-2xl border border-red-500/10 flex items-center gap-4 hover:border-red-500/20 hover:-translate-y-1 transition-all duration-300 shadow-[0_4px_20px_rgba(0,0,0,0.3)] hover:shadow-red-500/5 cursor-pointer" onClick={() => setActiveTab('tickets')}>
                <div className="bg-red-500/10 p-3 rounded-xl text-red-400 shadow-[0_0_15px_rgba(239,68,68,0.1)]">
                  <Ticket className="w-6 h-6" />
                </div>
                <div>
                  <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider">ตั๋วรอตรวจสอบ</span>
                  <h3 className="text-xl sm:text-2xl font-black text-red-400 mt-0.5 flex items-center gap-2">
                    {statsLoading ? <span className="inline-block w-16 h-6 skeleton-pulse rounded" /> : stats?.pendingTickets?.toLocaleString()}
                    {!statsLoading && stats?.pendingTickets > 0 && (
                      <span className="w-2 h-2 bg-red-500 rounded-full animate-ping" />
                    )}
                  </h3>
                </div>
              </div>
            </div>

            {/* Secondary stats & charts/lists grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Left 2 Cols: Top Selling Products & System stats */}
              <div className="lg:col-span-2 space-y-6">
                
                {/* Daily Charts Grid */}
                <div className="grid grid-cols-1 gap-6">
                  {/* Chart 1: Sales Revenue */}
                  <div className="bg-zinc-950/40 border border-white/5 p-6 rounded-3xl backdrop-blur-md space-y-4">
                    <div>
                      <h3 className="text-sm font-bold text-white flex items-center gap-2">
                        <CheckSquare className="w-4 h-4 text-emerald-400" />
                        <span>สถิติมูลค่าการขายสินค้า (7 วันล่าสุด)</span>
                      </h3>
                      <p className="text-[10px] text-zinc-500 font-sans">วิเคราะห์มูลค่าการจำหน่ายสินค้าสะสมรายวัน</p>
                    </div>

                    {statsLoading ? (
                      <div className="h-[150px] flex flex-col items-center justify-center gap-3 text-xs text-zinc-500">
                        <Loader2 className="w-6 h-6 animate-spin text-sky-400" />
                        <span>กำลังโหลดกราฟยอดขาย...</span>
                      </div>
                    ) : (
                      <div className="w-full overflow-hidden">
                        {(() => {
                          const maxSalesVal = Math.max(...(stats?.dailyStats?.map(d => d.sales) || [1000]), 1000);
                          const pointsSales = stats?.dailyStats?.map((d, i) => {
                            const x = (i / 6) * 440 + 30;
                            const y = 170 - (d.sales / maxSalesVal) * 140;
                            return `${x},${y}`;
                          }) || [];

                          const pathSales = pointsSales.length > 0 ? `M ${pointsSales.join(' L ')}` : '';
                          const areaSales = pointsSales.length > 0 ? `${pathSales} L 470,170 L 30,170 Z` : '';

                          return (
                            <svg viewBox="0 0 500 200" className="w-full h-auto overflow-visible select-none">
                              <defs>
                                <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="0%" stopColor="#10b981" stopOpacity="0.25" />
                                  <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                                </linearGradient>
                              </defs>

                              <line x1="30" y1="30" x2="470" y2="30" stroke="rgba(255,255,255,0.05)" strokeDasharray="3,3" />
                              <line x1="30" y1="100" x2="470" y2="100" stroke="rgba(255,255,255,0.05)" strokeDasharray="3,3" />
                              <line x1="30" y1="170" x2="470" y2="170" stroke="rgba(255,255,255,0.1)" />

                              <text x="24" y="34" fill="rgba(255,255,255,0.3)" fontSize="8" textAnchor="end">{maxSalesVal.toLocaleString()}</text>
                              <text x="24" y="104" fill="rgba(255,255,255,0.3)" fontSize="8" textAnchor="end">{(maxSalesVal / 2).toLocaleString()}</text>
                              <text x="24" y="174" fill="rgba(255,255,255,0.3)" fontSize="8" textAnchor="end">0</text>

                              {areaSales && <path d={areaSales} fill="url(#salesGrad)" />}
                              {pathSales && <path d={pathSales} fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />}

                              {stats?.dailyStats?.map((d, i) => {
                                const x = (i / 6) * 440 + 30;
                                const ySales = 170 - (d.sales / maxSalesVal) * 140;

                                // คำนวณตำแหน่งตัวเลขหลบเส้นเพื่อไม่ให้ซ้อนกัน
                                let yOffset = -8;
                                const len = stats.dailyStats.length;
                                if (i > 0 && i < len - 1) {
                                  const prev = stats.dailyStats[i-1].sales;
                                  const next = stats.dailyStats[i+1].sales;
                                  if (d.sales < prev && d.sales <= next) {
                                    yOffset = 14;
                                  } else if (d.sales < prev && d.sales > next) {
                                    yOffset = 14;
                                  }
                                } else if (i === len - 1 && i > 0) {
                                  const prev = stats.dailyStats[i-1].sales;
                                  if (d.sales < prev) {
                                    yOffset = 14;
                                  }
                                }

                                return (
                                  <g key={i}>
                                    <circle cx={x} cy={ySales} r="3" fill="#10b981" stroke="#09090b" strokeWidth="1" />
                                    {d.sales > 0 && (
                                      <text
                                        x={x}
                                        y={ySales + yOffset}
                                        fill="#10b981"
                                        stroke="#0d0d11"
                                        strokeWidth="4"
                                        paintOrder="stroke"
                                        strokeLinejoin="round"
                                        fontSize="7"
                                        fontWeight="bold"
                                        textAnchor="middle"
                                      >
                                        {d.sales.toLocaleString()}
                                      </text>
                                    )}
                                    <text x={x} y="190" fill="rgba(255,255,255,0.4)" fontSize="8" textAnchor="middle">
                                      {d.date}
                                    </text>
                                  </g>
                                );
                              })}
                            </svg>
                          );
                        })()}
                      </div>
                    )}
                  </div>

                  {/* Chart 2: Topup Volume */}
                  <div className="bg-zinc-950/40 border border-white/5 p-6 rounded-3xl backdrop-blur-md space-y-4">
                    <div>
                      <h3 className="text-sm font-bold text-white flex items-center gap-2">
                        <CheckSquare className="w-4 h-4 text-sky-400" />
                        <span>สถิติมูลค่าการเติมเงิน (7 วันล่าสุด)</span>
                      </h3>
                      <p className="text-[10px] text-zinc-500 font-sans">วิเคราะห์ยอดการเติมเงินสะสมเข้าระบบรายวัน</p>
                    </div>

                    {statsLoading ? (
                      <div className="h-[150px] flex flex-col items-center justify-center gap-3 text-xs text-zinc-500">
                        <Loader2 className="w-6 h-6 animate-spin text-sky-400" />
                        <span>กำลังโหลดกราฟยอดเติมเงิน...</span>
                      </div>
                    ) : (
                      <div className="w-full overflow-hidden">
                        {(() => {
                          const maxTopupsVal = Math.max(...(stats?.dailyStats?.map(d => d.topups) || [1000]), 1000);
                          const pointsTopups = stats?.dailyStats?.map((d, i) => {
                            const x = (i / 6) * 440 + 30;
                            const y = 170 - (d.topups / maxTopupsVal) * 140;
                            return `${x},${y}`;
                          }) || [];

                          const pathTopups = pointsTopups.length > 0 ? `M ${pointsTopups.join(' L ')}` : '';
                          const areaTopups = pointsTopups.length > 0 ? `${pathTopups} L 470,170 L 30,170 Z` : '';

                          return (
                            <svg viewBox="0 0 500 200" className="w-full h-auto overflow-visible select-none">
                              <defs>
                                <linearGradient id="topupsGrad" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="0%" stopColor="#0ea5e9" stopOpacity="0.25" />
                                  <stop offset="100%" stopColor="#0ea5e9" stopOpacity="0.0" />
                                </linearGradient>
                              </defs>

                              <line x1="30" y1="30" x2="470" y2="30" stroke="rgba(255,255,255,0.05)" strokeDasharray="3,3" />
                              <line x1="30" y1="100" x2="470" y2="100" stroke="rgba(255,255,255,0.05)" strokeDasharray="3,3" />
                              <line x1="30" y1="170" x2="470" y2="170" stroke="rgba(255,255,255,0.1)" />

                              <text x="24" y="34" fill="rgba(255,255,255,0.3)" fontSize="8" textAnchor="end">{maxTopupsVal.toLocaleString()}</text>
                              <text x="24" y="104" fill="rgba(255,255,255,0.3)" fontSize="8" textAnchor="end">{(maxTopupsVal / 2).toLocaleString()}</text>
                              <text x="24" y="174" fill="rgba(255,255,255,0.3)" fontSize="8" textAnchor="end">0</text>

                              {areaTopups && <path d={areaTopups} fill="url(#topupsGrad)" />}
                              {pathTopups && <path d={pathTopups} fill="none" stroke="#0ea5e9" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />}

                              {stats?.dailyStats?.map((d, i) => {
                                const x = (i / 6) * 440 + 30;
                                const yTopups = 170 - (d.topups / maxTopupsVal) * 140;

                                // คำนวณตำแหน่งตัวเลขหลบเส้นเพื่อไม่ให้ซ้อนกัน
                                let yOffset = -8;
                                const len = stats.dailyStats.length;
                                if (i > 0 && i < len - 1) {
                                  const prev = stats.dailyStats[i-1].topups;
                                  const next = stats.dailyStats[i+1].topups;
                                  if (d.topups < prev && d.topups <= next) {
                                    yOffset = 14;
                                  } else if (d.topups < prev && d.topups > next) {
                                    yOffset = 14;
                                  }
                                } else if (i === len - 1 && i > 0) {
                                  const prev = stats.dailyStats[i-1].topups;
                                  if (d.topups < prev) {
                                    yOffset = 14;
                                  }
                                }

                                return (
                                  <g key={i}>
                                    <circle cx={x} cy={yTopups} r="3" fill="#0ea5e9" stroke="#09090b" strokeWidth="1" />
                                    {d.topups > 0 && (
                                      <text
                                        x={x}
                                        y={yTopups + yOffset}
                                        fill="#0ea5e9"
                                        stroke="#0d0d11"
                                        strokeWidth="4"
                                        paintOrder="stroke"
                                        strokeLinejoin="round"
                                        fontSize="7"
                                        fontWeight="bold"
                                        textAnchor="middle"
                                      >
                                        {d.topups.toLocaleString()}
                                      </text>
                                    )}
                                    <text x={x} y="190" fill="rgba(255,255,255,0.4)" fontSize="8" textAnchor="middle">
                                      {d.date}
                                    </text>
                                  </g>
                                );
                              })}
                            </svg>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                </div>


                {/* Top Selling Products Card */}
                <div className="bg-zinc-950/40 border border-white/5 p-6 rounded-3xl backdrop-blur-md space-y-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="text-sm font-bold text-white flex items-center gap-2">
                        <Award className="w-4 h-4 text-amber-400" />
                        <span>สินค้าขายดีที่สุด 5 อันดับแรก</span>
                      </h3>
                      <p className="text-[10px] text-zinc-500">วิเคราะห์ยอดการจำหน่ายสะสมของผลิตภัณฑ์ในร้านค้า</p>
                    </div>
                  </div>

                  {statsLoading ? (
                    <div className="py-10 flex flex-col items-center justify-center gap-3 text-xs text-zinc-500">
                      <Loader2 className="w-6 h-6 animate-spin text-sky-400" />
                      <span>กำลังโหลดสถิติสินค้าขายดี...</span>
                    </div>
                  ) : !stats?.topProducts || stats.topProducts.length === 0 ? (
                    <div className="py-10 text-center text-xs text-zinc-500 border border-dashed border-white/5 rounded-2xl">
                      ยังไม่มีประวัติการสั่งซื้อสินค้าในระบบ
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {stats.topProducts.map((p, idx) => {
                        // คำนวณเปอร์เซ็นต์เพื่อแสดงหลอดความก้าวหน้า
                        const maxSold = Math.max(...stats.topProducts.map(item => item.sold || 1));
                        const percentage = ((p.sold || 0) / maxSold) * 100;

                        return (
                          <div key={p.id} className="flex items-center gap-4 bg-zinc-900/30 border border-white/5 p-3 rounded-xl hover:bg-zinc-900/60 transition-colors">
                            <span className="text-xs font-black text-zinc-500 w-4">#{idx + 1}</span>
                            <img src={p.image} alt={p.name} className="w-10 h-10 object-cover rounded-lg border border-white/5 bg-zinc-900" />
                            <div className="flex-1 min-w-0">
                              <span className="text-xs font-semibold text-white block truncate">{p.name}</span>
                              <div className="w-full bg-zinc-950 rounded-full h-1.5 mt-1.5 overflow-hidden">
                                <div 
                                  className="bg-gradient-to-r from-sky-500 to-emerald-500 h-1.5 rounded-full transition-all duration-500" 
                                  style={{ width: `${percentage}%` }}
                                />
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <span className="text-xs font-bold text-sky-400 block">{p.price?.toLocaleString()} THB</span>
                              <span className="text-[10px] text-zinc-400 font-sans">ขายแล้ว {p.sold || 0} ชิ้น</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                </div>

                {/* Recent Transactions Card */}
                <div className="bg-zinc-950/40 border border-white/5 p-6 rounded-3xl backdrop-blur-md space-y-4 font-sans">
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="text-sm font-bold text-white flex items-center gap-2">
                        <Layers className="w-4 h-4 text-sky-400" />
                        <span>ประวัติการทำรายการล่าสุด 5 รายการ</span>
                      </h3>
                      <p className="text-[10px] text-zinc-500">ติดตามความเคลื่อนไหวธุรกรรมการซื้อและการเติมเงินของสมาชิกล่าสุด</p>
                    </div>
                    <button onClick={() => setActiveTab('transactions')} className="text-[10px] font-bold text-sky-400 hover:text-sky-300 transition-colors">
                      ดูทั้งหมด &rarr;
                    </button>
                  </div>

                  {statsLoading ? (
                    <div className="py-10 flex flex-col items-center justify-center gap-3 text-xs text-zinc-500">
                      <Loader2 className="w-6 h-6 animate-spin text-sky-400" />
                      <span>กำลังโหลดรายการล่าสุด...</span>
                    </div>
                  ) : !stats?.recentTransactions || stats.recentTransactions.length === 0 ? (
                    <div className="py-10 text-center text-xs text-zinc-500 border border-dashed border-white/5 rounded-2xl">
                      ยังไม่มีรายการธุรกรรมในระบบ
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="border-b border-white/5 text-zinc-500 font-bold uppercase">
                            <th className="pb-2 font-semibold">ผู้ใช้งาน</th>
                            <th className="pb-2 font-semibold">ประเภท</th>
                            <th className="pb-2 font-semibold">รายละเอียด</th>
                            <th className="pb-2 font-semibold text-right">จำนวน</th>
                            <th className="pb-2 font-semibold text-right">วันเวลา</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5 text-zinc-300">
                          {stats.recentTransactions.map((tx) => {
                            let typeText = 'ปรับปรุง';
                            let typeStyle = 'bg-amber-500/10 border-amber-500/10 text-amber-400';
                            if (tx.type === 'topup') {
                              typeText = 'เติมเงิน';
                              typeStyle = 'bg-emerald-500/10 border-emerald-500/10 text-emerald-400';
                            } else if (tx.type === 'purchase') {
                              typeText = 'ซื้อของ';
                              typeStyle = 'bg-red-500/10 border-red-500/10 text-red-400';
                            }

                            return (
                              <tr key={tx.id} className="hover:bg-white/5 transition-colors">
                                <td className="py-2.5 font-bold text-white max-w-[100px] truncate">{tx.username}</td>
                                <td className="py-2.5">
                                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${typeStyle}`}>
                                    {typeText}
                                  </span>
                                </td>
                                <td className="py-2.5 text-zinc-400 max-w-[150px] truncate">{tx.description || '-'}</td>
                                <td className={`py-2.5 font-bold text-right ${tx.amount < 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                                  {tx.amount > 0 ? '+' : ''}{tx.amount.toLocaleString()}
                                </td>
                                <td className="py-2.5 text-right text-zinc-500 text-[10px]">
                                  {new Date(tx.createdAt).toLocaleDateString('th-TH', { hour: '2-digit', minute: '2-digit' })}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}

                </div>

                {/* Stock & categories status row */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="bg-zinc-950/20 border border-white/5 p-4 rounded-2xl flex items-center gap-3">
                    <div className="bg-sky-500/10 p-2.5 rounded-lg text-sky-400">
                      <ShoppingBag className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="text-[9px] text-zinc-500 uppercase font-semibold block">ประเภทสินค้า</span>
                      <span className="text-base font-bold text-white">
                        {statsLoading ? '...' : `${stats?.products?.toLocaleString()} รายการ`}
                      </span>
                    </div>
                  </div>

                  <div className="bg-zinc-950/20 border border-white/5 p-4 rounded-2xl flex items-center gap-3">
                    <div className="bg-sky-500/10 p-2.5 rounded-lg text-sky-400">
                      <Layers className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="text-[9px] text-zinc-500 uppercase font-semibold block">สต๊อกคลังรวม</span>
                      <span className="text-base font-bold text-white">
                        {statsLoading ? '...' : `${stats?.stock?.toLocaleString()} ชิ้น`}
                      </span>
                    </div>
                  </div>

                  <div className="bg-zinc-950/20 border border-white/5 p-4 rounded-2xl flex items-center gap-3">
                    <div className="bg-sky-500/10 p-2.5 rounded-lg text-sky-400">
                      <CheckSquare className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="text-[9px] text-zinc-500 uppercase font-semibold block">จำหน่ายรวม</span>
                      <span className="text-base font-bold text-white">
                        {statsLoading ? '...' : `${stats?.sold?.toLocaleString()} ชิ้น`}
                      </span>
                    </div>
                  </div>
                </div>

              </div>

              {/* Right 1 Col: System status & quick navigation links */}
              <div className="space-y-6 font-sans">
                
                {/* System status Card */}
                <div className="bg-zinc-950/40 border border-white/5 p-6 rounded-3xl backdrop-blur-md space-y-4">
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider">สถิติภาพรวมธุรกรรม</h3>
                  
                  <div className="space-y-3.5 text-xs">
                    <div className="flex justify-between items-center border-b border-white/5 pb-2 font-sans">
                      <span className="text-zinc-500">จำนวนธุรกรรมทั้งหมด</span>
                      <span className="text-white font-bold">
                        {statsLoading ? '...' : `${stats?.totalTransactions?.toLocaleString()} รายการ`}
                      </span>
                    </div>

                    <div className="flex justify-between items-center border-b border-white/5 pb-2">
                      <span className="text-zinc-500">คูปองที่เปิดใช้งานอยู่</span>
                      <span className="text-emerald-400 font-bold">
                        {statsLoading ? '...' : `${stats?.activeCoupons?.toLocaleString()} รหัส`}
                      </span>
                    </div>

                    <div className="flex justify-between items-center font-sans">
                      <span className="text-zinc-500">จำนวนการสุ่มกาชา</span>
                      <span className="text-amber-400 font-bold">
                        {statsLoading ? '...' : `${stats?.totalGachaSpins?.toLocaleString()} ครั้ง`}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Quick actions panel */}
                <div className="bg-zinc-950/40 border border-white/5 p-6 rounded-3xl backdrop-blur-md space-y-4">
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider">ทางลัดการจัดการแอดมิน</h3>
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={handleAddProduct} className="flex flex-col items-center justify-center p-3 bg-zinc-900 border border-white/5 hover:border-sky-500/30 rounded-xl transition-all cursor-pointer group text-center gap-1">
                      <Plus className="w-4 h-4 text-sky-400 group-hover:scale-110 transition-transform" />
                      <span className="text-[10px] text-zinc-400 font-semibold group-hover:text-white">เพิ่มสินค้าใหม่</span>
                    </button>
                    <button onClick={() => setActiveTab('banners')} className="flex flex-col items-center justify-center p-3 bg-zinc-900 border border-white/5 hover:border-sky-500/30 rounded-xl transition-all cursor-pointer group text-center gap-1">
                      <Layers className="w-4 h-4 text-sky-400 group-hover:scale-110 transition-transform" />
                      <span className="text-[10px] text-zinc-400 font-semibold group-hover:text-white">จัดการ Banner</span>
                    </button>
                  </div>
                </div>

              </div>

            </div>

          </div>
        )}

        {/* TAB 7: MANAGE BANNERS */}
        {activeTab === 'banners' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in-50 duration-200">

            {/* List Table of Banners (Col-span 2) */}
            <div className="lg:col-span-2 space-y-4">
              <div className="flex justify-between items-center bg-white/5 border border-white/5 p-4 rounded-2xl">
                <div>
                  <h3 className="text-sm font-bold text-white font-bold font-sans">รายการ Banner โปรโมต</h3>
                  <p className="text-[11px] text-zinc-500">จัดการข้อมูลแบนเนอร์สไลด์ที่แสดงหน้าแรกของเว็บไซต์</p>
                </div>
              </div>

              {bannersLoading ? (
                <div className="text-center py-20 text-xs text-zinc-500 flex flex-col items-center gap-3">
                  <Loader2 className="w-8 h-8 animate-spin text-sky-400" />
                  <span>กำลังโหลดข้อมูล Banner...</span>
                </div>
              ) : bannersList.length === 0 ? (
                <div className="text-center py-20 text-xs text-zinc-500 bg-zinc-950/20 border border-white/5 rounded-2xl">
                  ไม่พบข้อมูล Banner ในระบบ (ระบบจะแสดงแบนเนอร์สำรองที่หน้าแรก)
                </div>
              ) : (
                <div className="overflow-x-auto border border-white/5 rounded-2xl bg-zinc-950/20 backdrop-blur-md">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-white/10 bg-zinc-950/60 text-zinc-200 font-bold uppercase tracking-wider backdrop-blur-sm">
                        <th className="p-4">รูปภาพ</th>
                        <th className="p-4">หัวข้อ</th>
                        <th className="p-4">คำอธิบาย</th>
                        <th className="p-4">ลิงก์ปลายทาง</th>
                        <th className="p-4 text-right">ดำเนินการ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 text-zinc-300 font-sans">
                      {bannersList.map((banner) => (
                        <tr key={banner._id} className="hover:bg-white/5 transition-colors">
                          <td className="p-4">
                            <img
                              src={banner.image_url}
                              alt={banner.title}
                              className="w-24 h-12 object-cover rounded-lg border border-white/5 bg-zinc-900"
                            />
                          </td>
                          <td className="p-4 font-bold text-white max-w-[150px] truncate">{banner.title}</td>
                          <td className="p-4 text-zinc-400 max-w-[180px] truncate">{banner.description || '-'}</td>
                          <td className="p-4 font-mono text-[10px] text-sky-400">{banner.link_url}</td>
                          <td className="p-4 text-right whitespace-nowrap space-x-2">
                            <button
                              onClick={() => handleEditBanner(banner)}
                              className="inline-flex items-center gap-1 bg-zinc-900 text-sky-400 hover:text-sky-300 border border-white/5 hover:border-sky-500/20 p-2 rounded-lg cursor-pointer"
                              title="แก้ไข Banner"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteBanner(banner._id, banner.title)}
                              className="inline-flex items-center gap-1 bg-zinc-900 text-red-400 hover:text-red-300 border border-white/5 hover:border-red-500/20 p-2 rounded-lg cursor-pointer"
                              title="ลบ Banner"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Create / Edit Form Card (Col-span 1) */}
            <div className="lg:col-span-1 space-y-4">
              <div className="bg-zinc-950/40 border border-white/5 rounded-3xl p-6 backdrop-blur-md space-y-4">
                <div>
                  <h3 className="text-sm font-bold text-white">
                    {selectedBannerToEdit ? 'แก้ไข Banner' : 'เพิ่ม Banner ใหม่'}
                  </h3>
                  <p className="text-[11px] text-zinc-500">กรอกข้อมูลป้ายโปรโมตที่ต้องการจัดแสดง</p>
                </div>

                {bannerError && (
                  <div className="bg-red-500/10 border border-red-500/20 px-3 py-2.5 rounded-xl text-xs text-red-400 flex items-center gap-1.5 font-sans">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{bannerError}</span>
                  </div>
                )}

                <form onSubmit={selectedBannerToEdit ? handleEditBannerSubmit : handleCreateBanner} className="space-y-4 font-sans">

                  {/* Title */}
                  <div className="space-y-1">
                    <label className="text-xs text-zinc-400 font-semibold block">หัวข้อป้ายโปรโมต (ระบุหรือไม่ก็ได้)</label>
                    <input
                      type="text"
                      value={bannerTitle}
                      onChange={(e) => setBannerTitle(e.target.value)}
                      placeholder="เช่น ยินดีต้อนรับสู่ NakataShop"
                      className="w-full bg-[#03060d] border border-white/10 px-4 py-2.5 rounded-xl text-xs text-white placeholder-zinc-600 focus-glow transition-all duration-300"
                    />
                  </div>

                  {/* Description */}
                  <div className="space-y-1">
                    <label className="text-xs text-zinc-400 font-semibold block">รายละเอียดป้ายโปรโมต</label>
                    <textarea
                      value={bannerDesc}
                      onChange={(e) => setBannerDesc(e.target.value)}
                      placeholder="คำอธิบายสั้นๆ ของโปรโมชัน"
                      rows={2}
                      className="w-full bg-[#03060d] border border-white/10 px-4 py-2.5 rounded-xl text-xs text-white placeholder-zinc-600 focus-glow transition-all duration-300 resize-none"
                    />
                  </div>

                  {/* Image Options Toggle */}
                  <div className="space-y-2">
                    <label className="text-xs text-zinc-400 font-semibold block font-sans">ภาพแบนเนอร์ *</label>
                    <div className="flex bg-zinc-900 border border-white/5 p-1 rounded-xl w-full">
                      <button
                        type="button"
                        onClick={() => setBannerImgMode('url')}
                        className={`flex-1 text-[11px] font-bold py-1.5 rounded-lg transition-all cursor-pointer ${bannerImgMode === 'url' ? 'bg-sky-500 text-sky-950 shadow' : 'text-zinc-400 hover:text-white'
                          }`}
                      >
                        กรอก URL รูป
                      </button>
                      <button
                        type="button"
                        onClick={() => setBannerImgMode('upload')}
                        className={`flex-1 text-[11px] font-bold py-1.5 rounded-lg transition-all cursor-pointer ${bannerImgMode === 'upload' ? 'bg-sky-500 text-sky-950 shadow' : 'text-zinc-400 hover:text-white'
                          }`}
                      >
                        อัพโหลดไฟล์
                      </button>
                    </div>
                  </div>

                  {/* Image URL Input or Upload Input */}
                  {bannerImgMode === 'url' ? (
                    <div className="space-y-1">
                      <input
                        type="text"
                        value={bannerImgUrl}
                        onChange={(e) => setBannerImgUrl(e.target.value)}
                        placeholder="https://example.com/banner.jpg"
                        className="w-full bg-[#03060d] border border-white/10 px-4 py-2.5 rounded-xl text-xs text-white placeholder-zinc-600 focus-glow transition-all duration-300 font-mono"
                      />
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      <div className="relative flex items-center justify-center border border-dashed border-white/10 hover:border-sky-500/30 rounded-xl bg-[#03060d] p-4 transition-all overflow-hidden group">
                        {bannerUploading ? (
                          <div className="flex flex-col items-center py-2 text-sky-400 gap-2">
                            <Loader2 className="w-5 h-5 animate-spin" />
                            <span className="text-[10px] font-bold">กำลังอัปโหลด...</span>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center py-2 text-zinc-400 gap-1.5">
                            <svg className="w-6 h-6 stroke-[1.5] text-zinc-500 group-hover:text-sky-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            <span className="text-[10px] font-bold font-sans">คลิกเพื่ออัพโหลดรูปภาพ</span>
                          </div>
                        )}
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleBannerFileUpload}
                          disabled={bannerUploading}
                          className="absolute inset-0 opacity-0 cursor-pointer disabled:cursor-not-allowed"
                        />
                      </div>

                      {bannerImgUrl && (
                        <div className="p-2 border border-white/5 rounded-xl bg-zinc-950/40 space-y-1">
                          <span className="text-[9px] text-zinc-500 font-semibold block">ที่อยู่ภาพที่เลือก:</span>
                          <span className="text-[9px] text-sky-400 font-mono block truncate">{bannerImgUrl}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Image Preview if URL is valid */}
                  {bannerImgUrl && (
                    <div className="relative aspect-21/9 border border-white/5 rounded-xl overflow-hidden bg-zinc-900">
                      <img src={bannerImgUrl} alt="Preview" className="w-full h-full object-cover" />
                      <div className="absolute top-1.5 right-1.5 bg-black/60 px-2 py-0.5 rounded text-[8px] font-bold text-white">Preview</div>
                    </div>
                  )}

                  {/* Link Href */}
                  <div className="space-y-1">
                    <label className="text-xs text-zinc-400 font-semibold block font-sans">ลิงก์ปลายทาง (เมื่อกดปุ่ม - ระบุหรือไม่ก็ได้)</label>
                    <input
                      type="text"
                      value={bannerLinkUrl}
                      onChange={(e) => setBannerLinkUrl(e.target.value)}
                      placeholder="เช่น /products หรือ /gacha"
                      className="w-full bg-[#03060d] border border-white/10 px-4 py-2.5 rounded-xl text-xs text-white placeholder-zinc-600 focus-glow transition-all duration-300 font-mono"
                    />
                  </div>

                  {/* Button Action Text */}
                  <div className="space-y-1">
                    <label className="text-xs text-zinc-400 font-semibold block">ข้อความบนปุ่มกด (ระบุหรือไม่ก็ได้)</label>
                    <input
                      type="text"
                      value={bannerActionText}
                      onChange={(e) => setBannerActionText(e.target.value)}
                      placeholder="เช่น ดูสินค้าทั้งหมด หรือ สปินก๊าซา"
                      className="w-full bg-[#03060d] border border-white/10 px-4 py-2.5 rounded-xl text-xs text-white placeholder-zinc-600 focus-glow transition-all duration-300"
                    />
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-2 pt-2">
                    {selectedBannerToEdit && (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedBannerToEdit(null);
                          setBannerTitle('');
                          setBannerDesc('');
                          setBannerImgUrl('');
                          setBannerLinkUrl('/products');
                          setBannerActionText('ดูสินค้าทั้งหมด');
                          setBannerError('');
                        }}
                        className="flex-1 border border-white/5 hover:bg-white/5 text-zinc-400 hover:text-white font-bold py-3 rounded-xl transition-all text-xs cursor-pointer text-center"
                      >
                        ยกเลิก
                      </button>
                    )}
                    <button
                      type="submit"
                      disabled={createBannerMutation.isPending || updateBannerMutation.isPending || bannerUploading}
                      className="flex-2 w-full flex items-center justify-center gap-1.5 bg-sky-500 text-sky-950 font-bold py-3 rounded-xl hover:bg-sky-400 transition-all glow-btn text-xs disabled:opacity-50 cursor-pointer"
                    >
                      {(createBannerMutation.isPending || updateBannerMutation.isPending) ? (
                        <Loader2 className="w-4.5 h-4.5 animate-spin" />
                      ) : (
                        <>
                          <Save className="w-4.5 h-4.5" />
                          <span>{selectedBannerToEdit ? 'บันทึกการแก้ไข' : 'สร้าง Banner'}</span>
                        </>
                      )}
                    </button>
                  </div>

                </form>
              </div>
            </div>

          </div>
        )}

        {/* TAB 8: MANAGE TICKETS */}
        {activeTab === 'tickets' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch min-h-[500px] animate-in fade-in-50 duration-200">
            {/* Tickets list sidebar */}
            <div className="space-y-3">
              <div className="bg-zinc-950/40 border border-white/5 p-4 rounded-2xl">
                <span className="text-xs font-bold text-white block">ตั๋วคำร้องขอความช่วยเหลือทั้งหมด ({adminTickets.length})</span>
                <span className="text-[10px] text-zinc-500">กรองตั๋วแยกตามการตอบกลับล่าสุด</span>
              </div>

              <div className="space-y-2 overflow-y-auto max-h-[550px] pr-1">
                {adminTicketsLoading ? (
                  <div className="text-center py-10 text-xs text-zinc-500 flex flex-col items-center gap-2">
                    <Loader2 className="w-5 h-5 animate-spin text-sky-400" />
                    <span>กำลังโหลดตั๋ว...</span>
                  </div>
                ) : adminTickets.length === 0 ? (
                  <div className="glass p-8 text-center text-zinc-500 rounded-xl border border-white/5 text-[11px]">
                    ไม่มีการส่งตั๋วช่วยเหลือเข้ามาในระบบในขณะนี้
                  </div>
                ) : (
                  adminTickets.map((ticket) => (
                    <button
                      key={ticket._id}
                      onClick={() => setSelectedAdminTicketId(ticket._id)}
                      className={`w-full text-left p-4 rounded-2xl border transition-all cursor-pointer block space-y-2.5 ${selectedAdminTicketId === ticket._id
                          ? 'bg-sky-500/5 border-sky-500/20 text-white shadow-lg'
                          : 'bg-zinc-950/40 border-white/5 text-zinc-400 hover:bg-zinc-900/40 hover:text-white'
                        }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] bg-zinc-900 px-2 py-0.5 rounded font-bold border border-white/5 text-zinc-400">
                          {ticket.category === 'product' ? 'สินค้า' : ticket.category === 'topup' ? 'เติมเงิน' : ticket.category === 'gacha' ? 'ก๊าซา' : 'ทั่วไป'}
                        </span>
                        {ticket.status === 'open' ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 border border-amber-500/20 text-amber-400">รอตรวจสอบ</span>
                        ) : ticket.status === 'replied' ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-sky-500/10 border border-sky-500/20 text-sky-400">ตอบกลับแล้ว</span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-zinc-500/10 border border-white/5 text-zinc-500">ปิดแล้ว</span>
                        )}
                      </div>
                      <h3 className="text-xs font-bold truncate leading-snug">{ticket.title}</h3>
                      <div className="flex justify-between items-center text-[9px] text-zinc-500 font-sans">
                        <span>ผู้แจ้ง: {ticket.user?.username || 'ไม่ทราบชื่อ'}</span>
                        <span>#{ticket._id.substring(0, 8)}</span>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>

            {/* Chat Live panel */}
            <div className="lg:col-span-2 flex flex-col border border-white/5 rounded-3xl bg-zinc-950/30 backdrop-blur-md overflow-hidden">
              {selectedAdminTicketId && adminTickets.find(t => t._id === selectedAdminTicketId) ? (
                (() => {
                  const currentTicket = adminTickets.find(t => t._id === selectedAdminTicketId);
                  const txIdMatch = currentTicket?.description?.match(/Transaction ID:\s*([a-f0-9\-]{36})/i);
                  const isRefundReq = currentTicket?.description?.includes('[คำร้องขอคืนเงิน: ใช่]');
                  
                  let linkedTx = null;
                  let isAlreadyRefunded = false;

                  if (txIdMatch) {
                    const linkedTxId = txIdMatch[1];
                    linkedTx = allTransactions.find(t => t._id === linkedTxId || t.id === linkedTxId);
                    isAlreadyRefunded = allTransactions.some(tx => 
                      (tx.type === 'refund' || tx.type === 'topup') && 
                      tx.description?.includes(`คืนเงินตั๋วช่วยเหลือ #${currentTicket._id.substring(0, 8)}`)
                    );
                  }

                  return (
                    <>
                      {/* Chat header */}
                      <div className="p-4 border-b border-white/5 bg-zinc-950/40 flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h2 className="text-xs font-bold text-white">{currentTicket.title}</h2>
                            {currentTicket.status === 'open' ? (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 border border-amber-500/20 text-amber-400">รอตรวจสอบ</span>
                            ) : currentTicket.status === 'replied' ? (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-sky-500/10 border border-sky-500/20 text-sky-400">ตอบกลับแล้ว</span>
                            ) : (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-zinc-500/10 border border-white/5 text-zinc-500">ปิดแล้ว</span>
                            )}
                          </div>
                          <span className="text-[10px] text-zinc-500 block font-sans">
                            ผู้ร้องเรียน: {currentTicket.user?.username} ({currentTicket.user?.email}) • ตั๋วไอดี: #{currentTicket._id}
                          </span>
                        </div>

                        {currentTicket.status !== 'closed' && (
                          <button
                            onClick={() => {
                              if (window.confirm('คุณแน่ใจว่าต้องการทำรายการปิดตั๋วคำร้องนี้แล้ว?')) {
                                adminCloseTicketMutation.mutate(currentTicket._id);
                              }
                            }}
                            disabled={adminCloseTicketMutation.isPending || adminRefundTicketMutation.isPending}
                            className="text-[10px] font-bold bg-zinc-900 border border-white/5 hover:border-red-500/20 text-zinc-400 hover:text-red-400 px-3 py-1.5 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                          >
                            {adminCloseTicketMutation.isPending ? 'กำลังบันทึก...' : 'ปิดตั๋วคำร้องนี้'}
                          </button>
                        )}
                      </div>

                      {/* Linked Transaction & Refund Controls for Admin */}
                      {linkedTx && (
                        <div className="bg-zinc-950/45 border-b border-white/5 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          <div className="space-y-1">
                            <span className="text-[8px] bg-red-500/10 text-red-400 border border-red-500/20 px-2 py-0.5 rounded font-black uppercase tracking-wider block w-max">ธุรกรรมอ้างอิงของตั๋ว</span>
                            <h4 className="text-xs font-bold text-white leading-normal truncate max-w-sm pt-1">
                              {linkedTx.description.split('\n')[0]}
                            </h4>
                            <p className="text-[10px] text-zinc-400 font-mono">
                              ยอดชำระ: {Math.abs(linkedTx.amount).toLocaleString()} THB · วันที่: {new Date(linkedTx.createdAt).toLocaleDateString('th-TH')}
                            </p>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            <div className="mr-2">
                              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-[10px] font-black border ${
                                isAlreadyRefunded
                                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                  : isRefundReq
                                    ? 'bg-amber-500/10 text-amber-400 border-amber-500/25 animate-pulse'
                                    : 'bg-zinc-800 text-zinc-400 border-white/5'
                              }`}>
                                {isAlreadyRefunded 
                                  ? '✅ คืนเงินเครดิตแล้ว' 
                                  : isRefundReq 
                                    ? '🚨 ยื่นขอคืนเงิน' 
                                    : '🔗 เชื่อมโยงธุรกรรม'}
                              </span>
                            </div>
                            
                            {!isAlreadyRefunded && currentTicket.status !== 'closed' && (
                              <>
                                <button
                                  onClick={() => {
                                    if (window.confirm(`คุณแน่ใจว่าต้องการปฏิเสธการคืนเงินสำหรับธุรกรรมนี้ และปิดตั๋วคำร้องช่วยเหลือเลยใช่หรือไม่?`)) {
                                      adminSendReplyMutation.mutate({
                                        ticketId: currentTicket._id,
                                        message: '🤖 ระบบ: คำขอคืนเงินสำหรับรายการนี้ได้รับการตรวจสอบแล้วและไม่ได้รับการอนุมัติ (ระบบได้ทำการปิดใช้งานตั๋วนี้)'
                                      }, {
                                        onSuccess: () => {
                                          adminCloseTicketMutation.mutate(currentTicket._id);
                                        }
                                      });
                                    }
                                  }}
                                  disabled={adminSendReplyMutation.isPending || adminCloseTicketMutation.isPending}
                                  className="text-[10px] font-bold bg-[#0a0505] border border-red-500/20 hover:bg-red-950/10 text-red-400 px-3.5 py-2.5 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1 shadow-md shadow-red-500/5"
                                >
                                  ❌ ไม่คืนเงิน
                                </button>

                                <button
                                  onClick={() => {
                                    if (window.confirm(`คุณแน่ใจว่าต้องการอนุมัติคืนเงินเครดิตจำนวน ${Math.abs(linkedTx.amount).toLocaleString()} THB แก่ผู้ใช้งาน ${currentTicket.user?.username || 'ลูกค้า'}? (ระบบจะเติมเงินและปิดตั๋วนี้ทันที)`)) {
                                      adminRefundTicketMutation.mutate(currentTicket._id);
                                    }
                                  }}
                                  disabled={adminRefundTicketMutation.isPending}
                                  className="text-[10px] font-black bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white px-4 py-2.5 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-600/15"
                                >
                                  {adminRefundTicketMutation.isPending ? 'กำลังประมวลผล...' : '💸 อนุมัติคืนเงิน'}
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      )}
                      <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-[300px] max-h-[400px]">
                        {adminTicketMessagesLoading ? (
                          <div className="h-full flex flex-col items-center justify-center text-xs text-zinc-500 gap-1.5 py-12">
                            <Loader2 className="w-6 h-6 animate-spin text-sky-400" />
                            <span>กำลังดึงประวัติข้อความ...</span>
                          </div>
                        ) : (
                          adminTicketMessages.map((msg) => {
                            const isSelf = msg.is_admin_reply;
                            const isSystem = msg.message?.startsWith('🤖 ระบบ:');

                            if (isSystem) {
                              return (
                                <div key={msg._id} className="flex justify-center items-center py-2.5 w-full">
                                  <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-full px-5 py-2 text-[10px] text-emerald-400 font-bold tracking-wide shadow-lg">
                                    {msg.message}
                                  </div>
                                </div>
                              );
                            }

                            return (
                              <div
                                key={msg._id}
                                className={`flex flex-col max-w-[75%] space-y-1 ${isSelf ? 'ml-auto items-end' : 'mr-auto items-start'
                                  }`}
                              >
                                <div className="flex items-center gap-1.5 text-[9px] text-zinc-500 font-sans">
                                  <span className={isSelf ? 'text-sky-400 font-bold' : ''}>
                                    {isSelf ? 'คุณ (แอดมิน)' : msg.user?.username || 'ผู้ใช้'}
                                  </span>
                                  <span>•</span>
                                  <span>{new Date(msg.createdAt).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}</span>
                                </div>
                                <div className={`p-3 rounded-2xl text-xs break-all leading-relaxed whitespace-pre-wrap shadow-md transition-all duration-300 ${isSelf
                                    ? 'bg-gradient-to-br from-sky-500 to-sky-600 text-white rounded-tr-none font-medium shadow-sky-500/10'
                                    : 'bg-zinc-900/60 border border-white/5 text-zinc-200 rounded-tl-none hover:bg-zinc-900/80'
                                  }`}>
                                  {msg.message}
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>

                      {/* Reply form */}
                      <div className="p-4 border-t border-white/5 bg-zinc-950/40">
                        {currentTicket.status === 'closed' ? (
                          <div className="p-3 bg-zinc-900 border border-white/5 rounded-xl text-center text-xs text-zinc-500 font-sans">
                            🔒 ตั๋วคำร้องช่วยเหลือนี้ ถูกปิดใช้งานประเด็นคำถามไปแล้ว
                          </div>
                        ) : (
                          <form
                            onSubmit={(e) => {
                              e.preventDefault();
                              if (!adminReplyMessage.trim()) return;
                              adminSendReplyMutation.mutate({
                                ticketId: selectedAdminTicketId,
                                message: adminReplyMessage,
                              });
                            }}
                            className="space-y-2"
                          >
                            {adminReplyError && (
                              <span className="text-[10px] text-red-400 font-sans block">{adminReplyError}</span>
                            )}
                            <div className="flex gap-2">
                              <input
                                type="text"
                                value={adminReplyMessage}
                                onChange={(e) => setAdminReplyMessage(e.target.value)}
                                placeholder="พิมพ์ข้อความตอบกลับไปยังลูกค้า..."
                                className="flex-1 bg-[#03060d] border border-white/10 px-4 py-3 rounded-xl text-xs text-white placeholder-zinc-500 focus-glow transition-all duration-300 font-sans"
                                disabled={adminSendReplyMutation.isPending}
                              />
                              <button
                                type="submit"
                                disabled={adminSendReplyMutation.isPending || !adminReplyMessage.trim()}
                                className="bg-sky-500 text-sky-950 font-bold px-4 rounded-xl hover:bg-sky-400 transition-colors disabled:opacity-50 cursor-pointer flex items-center justify-center shrink-0 shadow-lg shadow-sky-500/10"
                              >
                                {adminSendReplyMutation.isPending ? (
                                  <Loader2 className="w-4.5 h-4.5 animate-spin" />
                                ) : (
                                  <Send className="w-4.5 h-4.5" />
                                )}
                              </button>
                            </div>
                          </form>
                        )}
                      </div>
                    </>
                  );
                })()
              ) : (
                <div className="space-y-3 py-16 text-center mx-auto">
                  <Ticket className="w-12 h-12 stroke-[1.2] text-zinc-700 mx-auto" />
                  <div>
                    <h3 className="text-xs font-bold text-zinc-400">ยังไม่มีการเลือกตั๋วสนทนา</h3>
                    <p className="text-[10px] text-zinc-500">กรุณาเลือกตั๋วคำร้องฝั่งซ้าย เพื่อตอบกลับลูกค้า</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 9: MANAGE POINT SHOP & X2 EVENT */}
        {activeTab === 'point-shop' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-stretch animate-in fade-in-50 duration-200">
            {/* Left Col: Config & Add form */}
            <div className="space-y-6">
              
              {/* Double Points Settings Card */}
              <div className="bg-gradient-to-br from-amber-500/5 via-zinc-950/40 to-transparent border border-amber-500/25 p-6 rounded-3xl backdrop-blur-md space-y-4">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Coins className="w-5 h-5 text-amber-500" />
                    <span>แคมเปญกิจกรรมคูณแต้ม 2 เท่า</span>
                  </h3>
                  <p className="text-[10px] text-zinc-500 mt-1 leading-normal">
                    เมื่อเปิดใช้งาน ลูกค้าทุกคนที่ซื้อของด้วยเงินเครดิตจะได้รับพอยท์สะสมเป็น 2 เท่าของอัตราปกติ
                  </p>
                </div>

                <div className="flex justify-between items-center py-2 bg-zinc-900/40 border border-white/5 px-4 rounded-xl">
                  <span className="text-xs text-zinc-300 font-semibold">สถานะแคมเปญขณะนี้:</span>
                  {adminPointShopData.isX2Active ? (
                    <span className="text-[10px] font-black text-amber-400 bg-amber-500/10 border border-amber-500/25 px-2.5 py-0.5 rounded-full select-none animate-pulse">⚡ กำลังคูณแต้ม 2 เท่า</span>
                  ) : (
                    <span className="text-[10px] font-black text-zinc-500 bg-zinc-950 border border-white/5 px-2.5 py-0.5 rounded-full select-none">ปิดใช้งานอยู่</span>
                  )}
                </div>

                <button
                  onClick={() => toggleX2Mutation.mutate(!adminPointShopData.isX2Active)}
                  disabled={toggleX2Mutation.isPending}
                  className={`w-full py-3 rounded-xl text-xs font-black transition-all cursor-pointer active:scale-95 flex items-center justify-center gap-2 ${
                    adminPointShopData.isX2Active
                      ? 'bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20'
                      : 'bg-gradient-to-r from-amber-500 to-yellow-400 text-amber-950 hover:from-amber-400 shadow-[0_4px_15px_rgba(245,158,11,0.15)]'
                  }`}
                >
                  {toggleX2Mutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : adminPointShopData.isX2Active ? (
                    <span>ปิดแคมเปญแต้ม X2</span>
                  ) : (
                    <span>เปิดกิจกรรมแต้ม X2 ⚡</span>
                  )}
                </button>
              </div>

              {/* Add Point Item Form */}
              <div className="bg-zinc-950/45 border border-white/5 p-6 rounded-3xl backdrop-blur-md space-y-4">
                <div>
                  <h3 className="text-sm font-bold text-white">
                    {selectedPointItemToEdit ? 'แก้ไขของรางวัลพอยท์ช็อป' : 'เพิ่มของรางวัลพอยท์ช็อปใหม่'}
                  </h3>
                  <p className="text-[10px] text-zinc-500">กรอกข้อมูลเพื่อวางของรางวัลให้ลูกค้าใช้แต้มมาแลก</p>
                </div>

                {pointItemError && (
                  <div className="bg-red-500/10 border border-red-500/20 p-3 rounded-xl text-xs text-red-400 flex items-center gap-2">
                    <AlertCircle className="w-4.5 h-4.5 shrink-0" />
                    <span>{pointItemError}</span>
                  </div>
                )}

                <form onSubmit={selectedPointItemToEdit ? handleEditPointItemSubmit : handleCreatePointItem} className="space-y-4 font-sans text-xs">
                  <div className="space-y-1">
                    <label className="text-zinc-400 font-semibold block">ชื่อของรางวัล *</label>
                    <input
                      type="text"
                      required
                      value={pointItemName}
                      onChange={(e) => setPointItemName(e.target.value)}
                      placeholder="เช่น คูปองส่วนลด 50 บาท"
                      className="w-full bg-[#03060d] border border-white/10 px-3 py-2 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:border-sky-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-zinc-400 font-semibold block">คำอธิบายรายละเอียด</label>
                    <textarea
                      value={pointItemDesc}
                      onChange={(e) => setPointItemDesc(e.target.value)}
                      placeholder="อธิบายสั้นๆ ของรางวัลชิ้นนี้..."
                      className="w-full h-16 bg-[#03060d] border border-white/10 px-3 py-2 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:border-sky-500 resize-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-zinc-400 font-semibold block">พอยท์ที่ต้องใช้ *</label>
                      <input
                        type="number"
                        required
                        min="1"
                        value={pointItemCost}
                        onChange={(e) => setPointItemCost(e.target.value)}
                        placeholder="เช่น 150"
                        className="w-full bg-[#03060d] border border-white/10 px-3 py-2 rounded-xl text-white focus:outline-none focus:border-sky-500"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-zinc-400 font-semibold block">จำนวนในสต็อก *</label>
                      <input
                        type="number"
                        required
                        value={pointItemStock}
                        onChange={(e) => setPointItemStock(e.target.value)}
                        placeholder="-1 = ไม่จำกัด"
                        className="w-full bg-[#03060d] border border-white/10 px-3 py-2 rounded-xl text-white focus:outline-none focus:border-sky-500"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-zinc-400 font-semibold block">ที่อยู่รูปภาพประกอบ (URL)</label>
                    <input
                      type="text"
                      value={pointItemImg}
                      onChange={(e) => setPointItemImg(e.target.value)}
                      placeholder="กรอก URL ภาพ (ไม่ระบุจะมีภาพมาตรฐานแทน)"
                      className="w-full bg-[#03060d] border border-white/10 px-3 py-2 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:border-sky-500 font-mono"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-zinc-400 font-semibold block">ประเภทการส่งมอบรางวัล *</label>
                    <select
                      value={pointItemRewardType}
                      onChange={(e) => {
                        setPointItemRewardType(e.target.value);
                        setPointItemRewardVal('');
                      }}
                      className="w-full bg-[#03060d] border border-white/10 px-3 py-2.5 rounded-xl text-white focus:outline-none focus:border-sky-500"
                    >
                      <option value="credit">เงินวอลเล็ตเติมกระเป๋า (Wallet Cash)</option>
                      <option value="coupon">เจนเนอเรตคูปองลดเงิน (Coupon)</option>
                      <option value="code">โค้ดดิจิทัลคีย์ในคลัง (Code Key)</option>
                    </select>
                  </div>

                  {/* Contextual values */}
                  <div className="space-y-1">
                    {pointItemRewardType === 'credit' && (
                      <>
                        <label className="text-zinc-400 font-semibold block">ระบุจำนวนเงินสด (บาท) *</label>
                        <input
                          type="number"
                          required
                          value={pointItemRewardVal}
                          onChange={(e) => setPointItemRewardVal(e.target.value)}
                          placeholder="เช่น 50"
                          className="w-full bg-[#03060d] border border-white/10 px-3 py-2 rounded-xl text-white focus:outline-none"
                        />
                      </>
                    )}
                    {pointItemRewardType === 'coupon' && (
                      <>
                        <label className="text-zinc-400 font-semibold block">ระบุมูลค่าส่วนลดคูปอง (บาท) *</label>
                        <input
                          type="number"
                          required
                          value={pointItemRewardVal}
                          onChange={(e) => setPointItemRewardVal(e.target.value)}
                          placeholder="เช่น 20"
                          className="w-full bg-[#03060d] border border-white/10 px-3 py-2 rounded-xl text-white focus:outline-none"
                        />
                      </>
                    )}
                    {pointItemRewardType === 'code' && (
                      <>
                        <label className="text-zinc-400 font-semibold block">ใส่รหัสโค้ดรางวัล (แยกบรรทัดละ 1 รหัส) *</label>
                        <textarea
                          required
                          value={pointItemRewardVal}
                          onChange={(e) => setPointItemRewardVal(e.target.value)}
                          placeholder="STEAM-KEY-1&#10;STEAM-KEY-2&#10;STEAM-KEY-3"
                          className="w-full h-24 bg-[#03060d] border border-white/10 px-3 py-2 rounded-xl text-white placeholder-zinc-600 focus:outline-none focus:border-sky-500 font-mono resize-none"
                        />
                      </>
                    )}
                  </div>

                  {/* Status toggle */}
                  <div className="flex items-center gap-2 py-2">
                    <input
                      type="checkbox"
                      id="pointItemActive"
                      checked={pointItemActive}
                      onChange={(e) => setPointItemActive(e.target.checked)}
                      className="w-4 h-4 rounded accent-sky-500 cursor-pointer"
                    />
                    <label htmlFor="pointItemActive" className="text-zinc-300 font-semibold select-none cursor-pointer">เปิดวางขายทันที</label>
                  </div>

                  {/* Submit buttons */}
                  <div className="flex gap-2">
                    {selectedPointItemToEdit && (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedPointItemToEdit(null);
                          setPointItemName('');
                          setPointItemDesc('');
                          setPointItemCost('');
                          setPointItemImg('');
                          setPointItemRewardType('credit');
                          setPointItemRewardVal('');
                          setPointItemStock('-1');
                          setPointItemActive(true);
                          setPointItemError('');
                        }}
                        className="flex-1 border border-white/5 hover:bg-white/5 text-zinc-400 hover:text-white py-3 rounded-xl transition-all cursor-pointer text-center font-bold"
                      >
                        ยกเลิกแก้ไข
                      </button>
                    )}
                    <button
                      type="submit"
                      disabled={createPointItemMutation.isPending || updatePointItemMutation.isPending}
                      className="flex-2 w-full flex items-center justify-center gap-1.5 bg-sky-500 text-sky-950 font-bold py-3 rounded-xl hover:bg-sky-400 transition-all cursor-pointer disabled:opacity-50 font-black"
                    >
                      {(createPointItemMutation.isPending || updatePointItemMutation.isPending) ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <>
                          <Save className="w-4 h-4" />
                          <span>{selectedPointItemToEdit ? 'บันทึกการแก้ไข' : 'วางของรางวัล'}</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>

            </div>

            {/* Right Col: Items List Table or Point Transactions */}
            <div className="lg:col-span-2 space-y-4">
              <div className="flex bg-zinc-900 border border-white/5 p-1 rounded-xl w-full sm:w-max font-sans">
                <button
                  onClick={() => setPointShopAdminSubTab('items')}
                  className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    pointShopAdminSubTab === 'items'
                      ? 'bg-amber-500 text-amber-950 font-bold shadow-md'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  รายการของรางวัล ({adminPointShopData.items?.length || 0})
                </button>
                <button
                  onClick={() => setPointShopAdminSubTab('gacha')}
                  className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    pointShopAdminSubTab === 'gacha'
                      ? 'bg-amber-500 text-amber-950 font-bold shadow-md'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  จัดการตู้ Point Gacha ({pointGachaItems?.length || 0})
                </button>
                <button
                  onClick={() => setPointShopAdminSubTab('history')}
                  className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    pointShopAdminSubTab === 'history'
                      ? 'bg-amber-500 text-amber-950 font-bold shadow-md'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  ประวัติธุรกรรมพอยท์ล่าสุด ({adminPointShopData.transactions?.length || 0})
                </button>
              </div>

              {pointShopAdminSubTab === 'items' ? (
                <>
                  <div className="bg-white/5 border border-white/5 p-4 rounded-2xl">
                    <span className="text-xs font-bold text-white block">รายการสินค้าแต้มสะสมทั้งหมด</span>
                    <span className="text-[10px] text-zinc-500">แอดมินสามารถสลับของรางวัล เปิด/ปิดสต็อก หรือคัดโค้ดคีย์แจกได้ที่นี่</span>
                  </div>

                  {adminPointShopLoading ? (
                    <div className="text-center py-20 text-xs text-zinc-500 flex flex-col items-center gap-3">
                      <Loader2 className="w-8 h-8 animate-spin text-sky-400" />
                      <span>กำลังดึงรายการสินค้าพอยท์ช็อป...</span>
                    </div>
                  ) : (
                    <div className="overflow-x-auto border border-white/5 rounded-2xl bg-zinc-950/20 backdrop-blur-md">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="border-b border-white/10 bg-zinc-950/60 text-zinc-200 font-bold uppercase tracking-wider backdrop-blur-sm">
                            <th className="p-4">รูปภาพ</th>
                            <th className="p-4">ของรางวัล</th>
                            <th className="p-4">ใช้พอยท์</th>
                            <th className="p-4">ประเภท/ข้อมูล</th>
                            <th className="p-4">สต็อกคงเหลือ</th>
                            <th className="p-4">สถานะ</th>
                            <th className="p-4 text-right">ดำเนินการ</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5 text-zinc-300">
                          {adminPointShopData.items?.map(item => {
                            const rData = item.reward_data || {};
                            return (
                              <tr key={item.id} className="hover:bg-white/5 transition-colors">
                                <td className="p-4">
                                  <img src={item.image_url || 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=100&auto=format&fit=crop&q=60'} alt={item.name} className="w-12 h-12 object-cover rounded-lg border border-white/5 bg-zinc-900" />
                                </td>
                                <td className="p-4">
                                  <div>
                                    <span className="font-semibold text-white block">{item.name}</span>
                                    <span className="text-[10px] text-zinc-500 leading-normal block max-w-[200px] truncate">{item.description || '-'}</span>
                                  </div>
                                </td>
                                <td className="p-4 font-bold text-amber-400 font-mono">{item.point_cost} แต้ม</td>
                                <td className="p-4">
                                  {item.reward_type === 'credit' && (
                                    <span className="text-[10px] text-emerald-400 font-semibold">Wallet: +{rData.amount} บาท</span>
                                  )}
                                  {item.reward_type === 'coupon' && (
                                    <span className="text-[10px] text-teal-400 font-semibold">คูปองลด: {rData.discount} บาท</span>
                                  )}
                                  {item.reward_type === 'code' && (
                                    <span className="text-[10px] text-sky-400 font-semibold">รหัสโค้ด: {(rData.codes || []).length} ชิ้น</span>
                                  )}
                                </td>
                                <td className="p-4 font-semibold font-mono">
                                  {item.stock === -1 ? 'ไม่จำกัด' : `${item.stock} ชิ้น`}
                                </td>
                                <td className="p-4">
                                  {item.is_active ? (
                                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">วางขายอยู่</span>
                                  ) : (
                                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-zinc-500/10 border border-white/5 text-zinc-500">ปิดตัวอยู่</span>
                                  )}
                                </td>
                                <td className="p-4 text-right whitespace-nowrap space-x-2">
                                  <button
                                    onClick={() => handleStartEditPointItem(item)}
                                    className="inline-flex items-center gap-1 bg-zinc-900 text-sky-400 hover:text-sky-300 border border-white/5 hover:border-sky-500/20 p-2 rounded-lg cursor-pointer transition-colors"
                                    title="แก้ไขรายการ"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => {
                                      if (window.confirm(`แน่ใจหรือไม่ว่าต้องการลบของรางวัล "${item.name}"?`)) {
                                        deletePointItemMutation.mutate(item.id);
                                      }
                                    }}
                                    className="inline-flex items-center gap-1 bg-zinc-900 text-red-400 hover:text-red-300 border border-white/5 hover:border-red-500/20 p-2 rounded-lg cursor-pointer transition-colors"
                                    title="ลบรายการ"
                                  >
                                    <Trash className="w-3.5 h-3.5" />
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              ) : pointShopAdminSubTab === 'gacha' ? (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in-50 duration-200">
                  {/* Left Column: Point Gacha Item form */}
                  <div className="space-y-4">
                    <div className="glass p-5 rounded-2xl border border-white/5 space-y-4 bg-zinc-950/20">
                      <h3 className="text-sm font-bold text-white flex items-center gap-2">
                        <Award className="w-4 h-4 text-amber-400" />
                        <span>เพิ่มของรางวัลสุ่มตู้พอยท์ (Point Gacha Item)</span>
                      </h3>

                      {gachaError && (
                        <div className="bg-red-500/10 border border-red-500/20 px-3 py-2 rounded-lg text-xs text-red-400 flex items-center gap-1.5">
                          <AlertCircle className="w-4 h-4 shrink-0" />
                          <span>{gachaError}</span>
                        </div>
                      )}

                      <form onSubmit={(e) => handleCreateGachaItem(e, pointGachaTier?.id)} className="space-y-3.5">
                        <div className="space-y-1">
                          <label className="text-[11px] text-zinc-400 font-semibold block">ชื่อของรางวัล *</label>
                          <input
                            type="text"
                            required
                            value={gachaName}
                            onChange={(e) => setGachaName(e.target.value)}
                            className="w-full bg-[#03060d] border border-white/10 px-4 py-2.5 rounded-xl text-xs text-white placeholder-zinc-500 focus-glow transition-all duration-300"
                            placeholder="เช่น Steam Wallet 200 บาท หรือ เกลือ"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[11px] text-zinc-400 font-semibold block">ประเภทของรางวัล *</label>
                          <select
                            value={gachaType}
                            onChange={(e) => setGachaType(e.target.value)}
                            className="w-full bg-[#03060d] border border-white/10 px-4 py-2.5 rounded-xl text-xs text-white focus-glow transition-all duration-300"
                          >
                            <option value="empty">เกลือ (ไม่ได้รางวัล)</option>
                            <option value="coupon">คูปองส่วนลดในร้านค้า</option>
                            <option value="code">แจกโค้ดคีย์/รหัสผ่านจริง</option>
                            <option value="topup">โค้ดเติมเงินเข้าเว็บ (เครดิต)</option>
                          </select>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[11px] text-zinc-400 font-semibold block">โอกาสสุ่มได้ (%) *</label>
                          <input
                            type="number"
                            required
                            min="0.01"
                            step="0.01"
                            value={gachaChance}
                            onChange={(e) => setGachaChance(e.target.value)}
                            className="w-full bg-[#03060d] border border-white/10 px-4 py-2.5 rounded-xl text-xs text-white placeholder-zinc-500 focus-glow transition-all duration-300"
                            placeholder="โอกาสออก เช่น 50"
                          />
                        </div>

                        {gachaType === 'coupon' && (
                          <div className="space-y-1">
                            <label className="text-[11px] text-zinc-400 font-semibold block">มูลค่าส่วนลดคูปอง (บาท) *</label>
                            <input
                              type="number"
                              required
                              min="1"
                              value={gachaDiscount}
                              onChange={(e) => setGachaDiscount(e.target.value)}
                              className="w-full bg-[#03060d] border border-white/10 px-4 py-2.5 rounded-xl text-xs text-white placeholder-zinc-500 focus-glow transition-all duration-300"
                              placeholder="มูลค่าคูปอง เช่น 100"
                            />
                          </div>
                        )}

                        {gachaType === 'topup' && (
                          <div className="space-y-1">
                            <label className="text-[11px] text-zinc-400 font-semibold block">ยอดเงินเติมเข้าบัญชีลูกค้า (บาท) *</label>
                            <input
                              type="number"
                              required
                              min="1"
                              value={gachaTopupAmount}
                              onChange={(e) => setGachaTopupAmount(e.target.value)}
                              className="w-full bg-[#03060d] border border-white/10 px-4 py-2.5 rounded-xl text-xs text-white placeholder-zinc-500 focus-glow transition-all duration-300"
                              placeholder="เช่น 50"
                            />
                          </div>
                        )}

                        {gachaType === 'code' && (
                          <div className="space-y-1">
                            <label className="text-[11px] text-zinc-400 font-semibold block">ระบุรหัสสินค้า (1 โค้ดต่อบรรทัด)</label>
                            <textarea
                              rows="3"
                              value={gachaStock}
                              onChange={(e) => setGachaStock(e.target.value)}
                              className="w-full bg-[#03060d] border border-white/10 px-4 py-2.5 rounded-xl text-xs text-white placeholder-zinc-500 focus-glow transition-all duration-300"
                              placeholder="CODE-XXXX-YYYY&#10;CODE-AAAA-BBBB"
                            />
                          </div>
                        )}

                        <button
                          type="submit"
                          disabled={createGachaItemMutation.isPending}
                          className="w-full flex items-center justify-center gap-1.5 bg-amber-500 text-amber-950 font-bold py-2.5 rounded-xl hover:bg-amber-400 transition-all text-xs glow-btn cursor-pointer"
                        >
                          {createGachaItemMutation.isPending ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <>
                              <Plus className="w-3.5 h-3.5" />
                              <span>เพิ่มรางวัลสุ่ม</span>
                            </>
                          )}
                        </button>
                      </form>
                    </div>
                  </div>

                  {/* Right Column: Point Gacha items table */}
                  <div className="lg:col-span-2 space-y-4">
                    <div className="bg-white/5 border border-white/5 p-4 rounded-2xl">
                      <span className="text-xs font-bold text-white block">รายการของรางวัลทั้งหมดในตู้ Point Gacha</span>
                      <span className="text-[10px] text-zinc-500">อัตราความน่าจะเป็นรวมทั้งหมด: {pointGachaItems.reduce((acc, cur) => acc + Number(cur.chance), 0).toFixed(2)}% (ต้องครบ 100%)</span>
                    </div>

                    {pointGachaLoading ? (
                      <div className="text-center py-20 text-xs text-zinc-500 flex flex-col items-center gap-3">
                        <Loader2 className="w-8 h-8 animate-spin text-amber-400" />
                        <span>กำลังโหลดข้อมูลของสุ่มแต้ม...</span>
                      </div>
                    ) : pointGachaItems.length === 0 ? (
                      <div className="text-center py-16 bg-zinc-950/20 border border-white/5 rounded-2xl">
                        <span className="text-xs text-zinc-500">ตู้นี้ยังไม่มีรายการของรางวัล</span>
                      </div>
                    ) : (
                      <div className="overflow-x-auto border border-white/5 rounded-2xl bg-zinc-950/20 backdrop-blur-md">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="border-b border-white/10 bg-zinc-950/60 text-zinc-200 font-bold uppercase tracking-wider backdrop-blur-sm font-sans">
                              <th className="p-4">ของรางวัล</th>
                              <th className="p-4">โอกาส (%)</th>
                              <th className="p-4">ประเภท/มูลค่า</th>
                              <th className="p-4">สต็อกรหัส</th>
                              <th className="p-4 text-right">ดำเนินการ</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-white/5 text-zinc-300">
                            {pointGachaItems.map((item) => (
                              <tr key={item.id} className="hover:bg-white/5 transition-colors">
                                <td className="p-4 font-semibold text-white">{item.name}</td>
                                <td className="p-4 font-bold text-sky-400 font-mono">{item.chance}%</td>
                                <td className="p-4 uppercase">
                                  {item.type === 'empty' && <span className="text-zinc-500">เกลือ 🧂</span>}
                                  {item.type === 'coupon' && <span className="text-teal-400">คูปองลด {item.discount}฿</span>}
                                  {item.type === 'topup' && <span className="text-emerald-400">เครดิต +{item.topup_amount}฿</span>}
                                  {item.type === 'code' && <span className="text-indigo-400">รหัสโค้ดรางวัล</span>}
                                </td>
                                <td className="p-4 font-mono font-semibold">
                                  {item.type === 'code' ? `${item.stock || 0} ชิ้น` : '-'}
                                </td>
                                <td className="p-4 text-right whitespace-nowrap space-x-2">
                                  {item.type === 'code' && (
                                    <button
                                      onClick={() => {
                                        setSelectedGachaForStockManagement(item);
                                        setGachaStockModalOpen(true);
                                      }}
                                      className="inline-flex items-center gap-1 bg-zinc-900 text-amber-400 hover:text-amber-300 border border-white/5 hover:border-amber-500/20 px-2.5 py-1 rounded-lg cursor-pointer transition-colors"
                                      title="เติมคีย์โค้ดของสุ่ม"
                                    >
                                      <Key className="w-3.5 h-3.5" />
                                      <span className="text-[10px] font-bold">เติมสต็อก</span>
                                    </button>
                                  )}
                                  <button
                                    onClick={() => handleStartEditGachaItem(item)}
                                    className="inline-flex items-center gap-1 bg-zinc-900 text-sky-400 hover:text-sky-300 border border-white/5 hover:border-sky-500/20 p-1.5 rounded-lg cursor-pointer"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => {
                                      if (window.confirm(`แน่ใจหรือไม่ว่าต้องการลบของรางวัลสุ่ม "${item.name}"?`)) {
                                        deleteGachaItemMutation.mutate(item.id);
                                      }
                                    }}
                                    className="inline-flex items-center gap-1 bg-zinc-900 text-red-400 hover:text-red-300 border border-white/5 hover:border-red-500/20 p-1.5 rounded-lg cursor-pointer"
                                  >
                                    <Trash className="w-3.5 h-3.5" />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <>
                  <div className="bg-white/5 border border-white/5 p-4 rounded-2xl">
                    <span className="text-xs font-bold text-white block">ประวัติความเคลื่อนไหวแต้มพอยท์ของสมาชิก (100 รายการล่าสุด)</span>
                    <span className="text-[10px] text-zinc-500">บันทึกประวัติการเคลมเควส ประวัติเช็คอิน รายการสปิน Point Gacha และการแลกพอยท์ช็อปของสมาชิกทุกคน</span>
                  </div>

                  {adminPointShopLoading ? (
                    <div className="text-center py-20 text-xs text-zinc-500 flex flex-col items-center gap-3">
                      <Loader2 className="w-8 h-8 animate-spin text-sky-400" />
                      <span>กำลังดึงประวัติการแลก...</span>
                    </div>
                  ) : !adminPointShopData.transactions || adminPointShopData.transactions.length === 0 ? (
                    <div className="text-center py-16 bg-zinc-950/20 border border-white/5 rounded-2xl">
                      <span className="text-xs text-zinc-500">ยังไม่มีประวัติการแลกหรือความเคลื่อนไหวพอยท์ของสมาชิก</span>
                    </div>
                  ) : (
                    <div className="overflow-x-auto border border-white/5 rounded-2xl bg-zinc-950/20 backdrop-blur-md animate-in fade-in duration-200">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="border-b border-white/10 bg-zinc-950/60 text-zinc-200 font-bold uppercase tracking-wider backdrop-blur-sm">
                            <th className="p-4">ผู้ใช้งาน</th>
                            <th className="p-4">คำอธิบายธุรกรรมพอยท์</th>
                            <th className="p-4">จำนวนพอยท์</th>
                            <th className="p-4">วันที่ทำรายการ</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5 text-zinc-300">
                          {adminPointShopData.transactions.map((tx) => {
                            const isEarn = tx.amount > 0;
                            return (
                              <tr key={tx.id} className="hover:bg-white/5 transition-colors">
                                <td className="p-4">
                                  <div>
                                    <span className="font-semibold text-white block">{tx.user?.username || 'ผู้ใช้ทั่วไป'}</span>
                                    <span className="text-[10px] text-zinc-500 block">{tx.user?.email || '-'}</span>
                                  </div>
                                </td>
                                <td className="p-4 font-medium text-zinc-300 max-w-sm whitespace-normal leading-relaxed font-sans">{tx.description}</td>
                                <td className={`p-4 font-bold font-mono ${isEarn ? 'text-amber-400' : 'text-red-400'}`}>
                                  {isEarn ? '+' : ''}{tx.amount} P
                                </td>
                                <td className="p-4 text-zinc-500 font-mono">
                                  {new Date(tx.created_at || tx.createdAt).toLocaleString('th-TH')}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              )}
            </div>

          </div>
        )}

        {/* TAB 10: MANAGE TOPUP CONFIG */}
        {activeTab === 'topup' && (
          <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in-50 duration-200">
            <div className="bg-white/5 border border-white/5 p-5 rounded-2xl">
              <h3 className="text-base font-black text-white flex items-center gap-2">
                <Sliders className="w-5 h-5 text-sky-400" />
                <span>ตั้งค่าระบบเติมเงิน (Topup Settings)</span>
              </h3>
              <p className="text-xs text-zinc-500 mt-1">เปิด/ปิดช่องทาง และปรับแต่งการตั้งค่าการโอนเงินของแต่ละช่องทาง</p>
            </div>

            {topupConfigLoading || !topupForm ? (
              <div className="flex justify-center items-center py-20 text-zinc-400 gap-2">
                <Loader2 className="w-6 h-6 animate-spin text-sky-400" />
                <span>กำลังโหลดข้อมูลการตั้งค่า...</span>
              </div>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  updateTopupConfigMutation.mutate(topupForm);
                }}
                className="space-y-6"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  
                  {/* 1. PromptPay QR Settings */}
                  <div className="bg-zinc-950/40 border border-white/5 p-6 rounded-3xl backdrop-blur-md space-y-4">
                    <div className="flex justify-between items-center border-b border-white/5 pb-3">
                      <h4 className="text-sm font-bold text-white flex items-center gap-2">
                        <Landmark className="w-5 h-5 text-sky-400" />
                        <span>PromptPay QR</span>
                      </h4>
                      <button
                        type="button"
                        onClick={() => setTopupForm({
                          ...topupForm,
                          promptpay: { ...topupForm.promptpay, enabled: !topupForm.promptpay.enabled }
                        })}
                        className={`px-3 py-1 rounded-lg text-[10px] font-black border transition-all cursor-pointer ${
                          topupForm.promptpay.enabled
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                            : 'bg-red-500/10 text-red-400 border-red-500/20'
                        }`}
                      >
                        {topupForm.promptpay.enabled ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}
                      </button>
                    </div>

                    <div className="space-y-3.5">
                      <div className="space-y-1">
                        <label className="text-xs text-zinc-400 font-semibold block">หมายเลขพร้อมเพย์ (PromptPay ID) *</label>
                        <input
                          type="text"
                          required
                          disabled={!topupForm.promptpay.enabled}
                          value={topupForm.promptpay.promptpayId || ''}
                          onChange={(e) => setTopupForm({
                            ...topupForm,
                            promptpay: { ...topupForm.promptpay, promptpayId: e.target.value }
                          })}
                          className="w-full bg-[#03060d] border border-white/5 px-4 py-2.5 rounded-xl text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-sky-500 transition-colors disabled:opacity-40"
                          placeholder="เบอร์มือถือ หรือ เลขบัตรประชาชน หรือ e-Wallet ID"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs text-zinc-400 font-semibold block">ชื่อผู้รับโอนเงินที่คาดหวัง (Expected Receiver Name)</label>
                        <input
                          type="text"
                          disabled={!topupForm.promptpay.enabled}
                          value={topupForm.promptpay.expectedName || ''}
                          onChange={(e) => setTopupForm({
                            ...topupForm,
                            promptpay: { ...topupForm.promptpay, expectedName: e.target.value }
                          })}
                          className="w-full bg-[#03060d] border border-white/5 px-4 py-2.5 rounded-xl text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-sky-500 transition-colors disabled:opacity-40"
                          placeholder="เช่น สมัชญ์ (ระบุเพื่อเพิ่มความปลอดภัย หรือว่างไว้เพื่อไม่ตรวจสอบ)"
                        />
                      </div>
                    </div>
                  </div>

                  {/* 2. TrueMoney Wallet Settings */}
                  <div className="bg-zinc-950/40 border border-white/5 p-6 rounded-3xl backdrop-blur-md flex flex-col justify-between">
                    <div className="space-y-4">
                      <div className="flex justify-between items-center border-b border-white/5 pb-3">
                        <h4 className="text-sm font-bold text-white flex items-center gap-2">
                          <Smartphone className="w-5 h-5 text-orange-400" />
                          <span>TrueMoney Wallet Gift</span>
                        </h4>
                        <button
                          type="button"
                          onClick={() => setTopupForm({
                            ...topupForm,
                            wallet: { ...topupForm.wallet, enabled: !topupForm.wallet.enabled }
                          })}
                          className={`px-3 py-1 rounded-lg text-[10px] font-black border transition-all cursor-pointer ${
                            topupForm.wallet.enabled
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                              : 'bg-red-500/10 text-red-400 border-red-500/20'
                          }`}
                        >
                          {topupForm.wallet.enabled ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}
                        </button>
                      </div>
                      <p className="text-xs text-zinc-500 leading-normal">
                        ช่องทางการสร้างซองของขวัญและนำลิงค์ซองของขวัญมากดแลกเงินเครดิตเข้าสู่กระเป๋า
                      </p>
                    </div>
                    <div className="pt-4 text-[10px] text-zinc-600 border-t border-white/5 mt-4">
                      * ลูกค้าจะได้รับเงินเครดิตทันทีตามจำนวนเงินที่ระบุในซองของขวัญ
                    </div>
                  </div>

                  {/* 3. TrueMoney Cashcard Settings */}
                  <div className="bg-zinc-950/40 border border-white/5 p-6 rounded-3xl backdrop-blur-md space-y-4">
                    <div className="flex justify-between items-center border-b border-white/5 pb-3">
                      <h4 className="text-sm font-bold text-white flex items-center gap-2">
                        <CreditCard className="w-5 h-5 text-amber-400" />
                        <span>TrueMoney Cashcard</span>
                      </h4>
                      <button
                        type="button"
                        onClick={() => setTopupForm({
                          ...topupForm,
                          cashcard: { ...topupForm.cashcard, enabled: !topupForm.cashcard.enabled }
                        })}
                        className={`px-3 py-1 rounded-lg text-[10px] font-black border transition-all cursor-pointer ${
                          topupForm.cashcard.enabled
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                            : 'bg-red-500/10 text-red-400 border-red-500/20'
                        }`}
                      >
                        {topupForm.cashcard.enabled ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}
                      </button>
                    </div>

                    <div className="space-y-3.5">
                      <div className="space-y-1">
                        <label className="text-xs text-zinc-400 font-semibold block">ค่าธรรมเนียมบัตรเงินสด (%) *</label>
                        <input
                          type="number"
                          required
                          min="0"
                          max="100"
                          disabled={!topupForm.cashcard.enabled}
                          value={topupForm.cashcard.feePercent ?? 15}
                          onChange={(e) => setTopupForm({
                            ...topupForm,
                            cashcard: { ...topupForm.cashcard, feePercent: Number(e.target.value) }
                          })}
                          className="w-full bg-[#03060d] border border-white/5 px-4 py-2.5 rounded-xl text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-sky-500 transition-colors disabled:opacity-40"
                          placeholder="เช่น 15"
                        />
                      </div>
                    </div>
                  </div>

                  {/* 4. Giftcode Settings */}
                  <div className="bg-zinc-950/40 border border-white/5 p-6 rounded-3xl backdrop-blur-md flex flex-col justify-between">
                    <div className="space-y-4">
                      <div className="flex justify-between items-center border-b border-white/5 pb-3">
                        <h4 className="text-sm font-bold text-white flex items-center gap-2">
                          <Wallet className="w-5 h-5 text-rose-400" />
                          <span>Gacha Code</span>
                        </h4>
                        <button
                          type="button"
                          onClick={() => setTopupForm({
                            ...topupForm,
                            giftcode: { ...topupForm.giftcode, enabled: !topupForm.giftcode.enabled }
                          })}
                          className={`px-3 py-1 rounded-lg text-[10px] font-black border transition-all cursor-pointer ${
                            topupForm.giftcode.enabled
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                              : 'bg-red-500/10 text-red-400 border-red-500/20'
                          }`}
                        >
                          {topupForm.giftcode.enabled ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}
                        </button>
                      </div>
                      <p className="text-xs text-zinc-500 leading-normal">
                        ช่องทางการนำรหัสโค้ดรางวัลที่ได้รับจากการสุ่มวงล้อ Gacha มาเคลมเป็นเงินเครดิตเข้ากระเป๋า
                      </p>
                    </div>
                    <div className="pt-4 text-[10px] text-zinc-600 border-t border-white/5 mt-4">
                      * รหัสของขวัญรางวัลต้องขึ้นต้นด้วย `TOPUP-` ในตาราง `topup_codes`
                    </div>
                  </div>

                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={updateTopupConfigMutation.isPending}
                  className="w-full flex items-center justify-center gap-2 bg-sky-500 text-sky-950 font-black py-4 rounded-xl hover:bg-sky-400 transition-all glow-btn disabled:opacity-50 cursor-pointer text-sm"
                >
                  {updateTopupConfigMutation.isPending ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>กำลังบันทึกข้อมูล...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-5 h-5" />
                      <span>บันทึกการตั้งค่าระบบเติมเงินทั้งหมด</span>
                    </>
                  )}
                </button>
              </form>
            )}
          </div>
        )}

      </main>

      {/* MODAL: ADJUST USER WALLET BALANCE & VIP RANK */}
      {selectedUserForAdjust && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm">
          <div className="absolute inset-0" onClick={() => setSelectedUserForAdjust(null)} />

          <div className="relative w-full max-w-md bg-[#060c13] border border-white/5 p-6 rounded-2xl shadow-2xl glass z-10 animate-in fade-in duration-200">
            <div className="flex justify-between items-center pb-4 border-b border-white/5 mb-4">
              <h2 className="text-sm font-bold text-white">
                ปรับปรุงบัญชี: <span className="text-sky-400">{selectedUserForAdjust.username}</span>
              </h2>
              <button
                onClick={() => setSelectedUserForAdjust(null)}
                className="p-1 rounded-lg border border-white/5 text-zinc-400 hover:text-white hover:bg-white/5 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {adjustError && (
              <div className="bg-red-500/10 border border-red-500/20 px-3 py-2 rounded-lg text-xs text-red-400 flex items-center gap-1.5 mb-4">
                <AlertCircle className="w-4.5 h-4.5 shrink-0" />
                <span>{adjustError}</span>
              </div>
            )}

            <form onSubmit={handleAdjustBalance} className="space-y-4 font-sans">
              <div className="grid grid-cols-3 gap-2 p-3 bg-sky-950/20 border border-sky-500/10 rounded-xl text-[10px] text-sky-400/90 leading-tight">
                <div>กระเป๋าเงิน: <span className="font-bold text-white block truncate">{selectedUserForAdjust.balance?.toLocaleString()} THB</span></div>
                <div>ยอดซื้อสะสม: <span className="font-bold text-white block truncate">{(selectedUserForAdjust.totalSpent || 0).toLocaleString()} THB</span></div>
                <div>แต้มสะสม: <span className="font-bold text-amber-400 block truncate">{(selectedUserForAdjust.points || 0).toLocaleString()} P</span></div>
              </div>

              {/* ส่วนที่ 1: ปรับแต่งกระเป๋าเงิน */}
              <div className="border-b border-white/5 pb-3.5 space-y-3">
                <span className="text-[10px] font-bold text-sky-400 uppercase tracking-wider block">1. จัดการกระเป๋าเงิน (Wallet)</span>
                <div className="space-y-1">
                  <label className="text-xs text-zinc-400 font-semibold block">ยอดเงินปรับปรุง (บาท)</label>
                  <input
                    type="number"
                    value={adjustAmount}
                    onChange={(e) => setAdjustAmount(e.target.value)}
                    className="w-full bg-[#03060d] border border-white/5 px-3 py-2 rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-sky-500"
                    placeholder="ป้อนค่าบวก (เพิ่มเงิน) หรือ ค่าลบ (ลดเงิน) เช่น 100 หรือ -50"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-zinc-400 font-semibold block">เหตุผลประกอบการปรับปรุงเงิน (ต้องระบุหากปรับเงิน)</label>
                  <input
                    type="text"
                    value={adjustReason}
                    onChange={(e) => setAdjustReason(e.target.value)}
                    className="w-full bg-[#03060d] border border-white/5 px-3 py-2 rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-sky-500"
                    placeholder="ระบุสาเหตุ เช่น คืนเงินล่าช้า หรือ ปรับแมนนวล"
                  />
                </div>
              </div>

              {/* ส่วนที่ 2: จัดการระดับยศสะสม */}
              <div className="border-b border-white/5 pb-3.5 space-y-3">
                <span className="text-[10px] font-bold text-sky-400 uppercase tracking-wider block">2. จัดการยศสมาชิก (VIP Rank)</span>

                <div className="space-y-1">
                  <label className="text-xs text-zinc-400 font-semibold block">ปุ่มด่วนเลือกยศ (Auto Rank Threshold)</label>
                  <select
                    onChange={(e) => {
                      if (e.target.value !== '') {
                        setAdjustSpent(e.target.value);
                      }
                    }}
                    className="w-full bg-[#03060d] border border-white/5 px-3 py-2 rounded-xl text-xs text-white focus:outline-none focus:border-sky-500"
                  >
                    <option value="">-- เลือกยศเพื่อเติมเกณฑ์ขั้นต่ำ --</option>
                    {RANKS.map((r, i) => (
                      <option key={i} value={r.minSpent}>
                        {r.name} (เกณฑ์สะสมอย่างน้อย: {r.minSpent.toLocaleString()} THB, ลด {r.discountPercent}%)
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-zinc-400 font-semibold block">ระบุยอดสะสมโดยละเอียด (บาท)</label>
                  <input
                    type="number"
                    min="0"
                    value={adjustSpent}
                    onChange={(e) => setAdjustSpent(e.target.value)}
                    className="w-full bg-[#03060d] border border-white/5 px-3 py-2 rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-sky-500"
                    placeholder="ระบุยอดสะสมโดยละเอียด เช่น 5200"
                  />
                </div>
              </div>

              {/* ส่วนที่ 3: จัดการแต้มสะสม */}
              <div className="space-y-3 pb-2">
                <span className="text-[10px] font-bold text-amber-500 uppercase tracking-wider block">3. จัดการแต้มสะสม (Points)</span>
                <div className="space-y-1">
                  <label className="text-xs text-zinc-400 font-semibold block">ยอดพอยท์ที่ปรับปรุง (แต้ม)</label>
                  <input
                    type="number"
                    value={adjustPoints}
                    onChange={(e) => setAdjustPoints(e.target.value)}
                    className="w-full bg-[#03060d] border border-white/5 px-3 py-2 rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-sky-500"
                    placeholder="ป้อนค่าบวก (เพิ่มแต้ม) หรือ ค่าลบ (ลดแต้ม) เช่น 50 หรือ -30"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={updateUserMutation.isPending}
                className="w-full flex items-center justify-center gap-1.5 bg-sky-500 text-sky-950 font-bold py-3 rounded-xl hover:bg-sky-400 transition-all glow-btn text-xs disabled:opacity-50 cursor-pointer"
              >
                {updateUserMutation.isPending ? (
                  <Loader2 className="w-4.5 h-4.5 animate-spin" />
                ) : (
                  <>
                    <Save className="w-4.5 h-4.5" />
                    <span>บันทึกการปรับปรุงข้อมูลผู้ใช้</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EDIT GACHA ITEM */}
      {selectedGachaToEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm">
          <div className="absolute inset-0" onClick={() => setSelectedGachaToEdit(null)} />

          <div className="relative w-full max-w-md bg-[#060c13] border border-white/5 p-6 rounded-2xl shadow-2xl glass z-10 animate-in fade-in duration-200">
            <div className="flex justify-between items-center pb-4 border-b border-white/5 mb-4">
              <h2 className="text-sm font-bold text-white">
                แก้ไขของรางวัลสุ่ม: <span className="text-sky-400">{selectedGachaToEdit.name}</span>
              </h2>
              <button
                onClick={() => setSelectedGachaToEdit(null)}
                className="p-1 rounded-lg border border-white/5 text-zinc-400 hover:text-white hover:bg-white/5 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {editGachaError && (
              <div className="bg-red-500/10 border border-red-500/20 px-3 py-2 rounded-lg text-xs text-red-400 flex items-center gap-1.5 mb-4">
                <AlertCircle className="w-4.5 h-4.5 shrink-0" />
                <span>{editGachaError}</span>
              </div>
            )}

            <form onSubmit={handleEditGachaItemSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs text-zinc-400 font-semibold block">ชื่อของรางวัล *</label>
                <input
                  type="text"
                  required
                  value={editGachaName}
                  onChange={(e) => setEditGachaName(e.target.value)}
                  className="w-full bg-[#03060d] border border-white/5 px-3 py-2.5 rounded-xl text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-sky-500"
                  placeholder="เช่น Steam Wallet 200 บาท หรือ เกลือ"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs text-zinc-400 font-semibold block">เปอร์เซ็นต์รางวัล (%) *</label>
                <input
                  type="number"
                  required
                  min="0" step="0.01"
                  value={editGachaChance}
                  onChange={(e) => setEditGachaChance(e.target.value)}
                  className="w-full bg-[#03060d] border border-white/5 px-3 py-2.5 rounded-xl text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-sky-500"
                  placeholder="เช่น 10"
                />
              </div>

              {selectedGachaToEdit.type === 'coupon' && (
                <div className="space-y-1">
                  <label className="text-xs text-zinc-400 font-semibold block">มูลค่าส่วนลดคูปอง (บาท) *</label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={editGachaDiscount}
                    onChange={(e) => setEditGachaDiscount(e.target.value)}
                    className="w-full bg-[#03060d] border border-white/5 px-3 py-2.5 rounded-xl text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-sky-500"
                    placeholder="เช่น 50"
                  />
                </div>
              )}

              {selectedGachaToEdit.type === 'topup' && (
                <div className="space-y-1">
                  <label className="text-xs text-zinc-400 font-semibold block">ยอดเงินเติมเข้าเว็บ (บาท) *</label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={editGachaTopupAmount}
                    onChange={(e) => setEditGachaTopupAmount(e.target.value)}
                    className="w-full bg-[#03060d] border border-white/5 px-3 py-2.5 rounded-xl text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-sky-500"
                    placeholder="เช่น 50"
                  />
                </div>
              )}

              <button
                type="submit"
                disabled={updateGachaItemMutation.isPending}
                className="w-full flex items-center justify-center gap-1.5 bg-sky-500 text-sky-950 font-bold py-3 rounded-xl hover:bg-sky-400 transition-all glow-btn text-xs disabled:opacity-50 cursor-pointer"
              >
                {updateGachaItemMutation.isPending ? (
                  <Loader2 className="w-4.5 h-4.5 animate-spin" />
                ) : (
                  <>
                    <Save className="w-4.5 h-4.5" />
                    <span>บันทึกข้อมูลของรางวัล</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Footer */}
      <Footer onOpenContact={() => setContactOpen(true)} />

      {/* Auxiliary Modals */}
      <ContactModal isOpen={contactOpen} onClose={() => setContactOpen(false)} />
      <HistoryModal isOpen={historyOpen} onClose={() => setHistoryOpen(false)} />

      {/* Admin Product modal */}
      <AdminProductModal
        isOpen={productModalOpen}
        onClose={() => setProductModalOpen(false)}
        productToEdit={selectedProductToEdit}
      />

      {/* Admin Stock modal */}
      <AdminStockModal
        isOpen={stockModalOpen}
        onClose={() => {
          setStockModalOpen(false);
          setSelectedProductForStock(null);
        }}
        product={selectedProductForStock}
      />

      {/* Admin Gacha Stock modal */}
      <AdminGachaStockModal
        isOpen={gachaStockModalOpen}
        onClose={() => {
          setGachaStockModalOpen(false);
          setSelectedGachaForStockManagement(null);
        }}
        gachaItem={selectedGachaForStockManagement}
      />
    </div>
  );
}
