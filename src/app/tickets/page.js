'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  MessageSquare, Plus, Send, X, Loader2, AlertCircle, 
  CheckCircle, Ticket, ArrowLeft, Shield, Calendar, HelpCircle,
  Tag, RefreshCw, Landmark, ArrowUpRight
} from 'lucide-react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import CanvasBackground from '../components/CanvasBackground';
import Link from 'next/link';

function TicketsPageContent() {
  const { data: session, status } = useSession();
  const queryClient = useQueryClient();

  const [selectedTicketId, setSelectedTicketId] = useState(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);

  // New ticket form state
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState('product'); // product | topup | gacha | other
  const [newDescription, setNewDescription] = useState('');
  const [selectedTxId, setSelectedTxId] = useState('');
  const [isRefundRequested, setIsRefundRequested] = useState(false);
  const [formError, setFormError] = useState('');

  const [replyMessage, setReplyMessage] = useState('');
  const [replyError, setReplyError] = useState('');

  const messagesEndRef = useRef(null);
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Read query params for pre-filled report from inventory page
  const searchParams = useSearchParams();

  // Query: User Transactions (for referencing in tickets)
  const { data: userTransactions = [] } = useQuery({
    queryKey: ['user-transactions-for-tickets'],
    queryFn: async () => {
      const res = await fetch('/api/transactions');
      if (!res.ok) throw new Error('ไม่สามารถโหลดประวัติธุรกรรมได้');
      return res.json();
    },
    enabled: status === 'authenticated',
  });

  useEffect(() => {
    const isReport = searchParams.get('report');
    if (isReport === 'true' && status === 'authenticated') {
      const product = searchParams.get('product') || '';
      const desc = searchParams.get('desc') || '';
      const amount = searchParams.get('amount') || '';
      const txId = searchParams.get('txId') || '';

      setNewCategory('product');
      setNewTitle(`แจ้งปัญหาสินค้า: ${product}`);
      setSelectedTxId(txId);
      setNewDescription(`รายละเอียดสินค้าที่มีปัญหา:\nสินค้า: ${product}\nยอดชำระ: ${amount} THB\nรายละเอียดคีย์: ${desc}`);
      setIsRefundRequested(true); // Auto request refund if reported from inventory
      setCreateModalOpen(true);
    }
  }, [searchParams, status]);

  // 1. Query: List Tickets
  const { data: tickets = [], isLoading: ticketsLoading } = useQuery({
    queryKey: ['user-tickets'],
    queryFn: async () => {
      const res = await fetch('/api/support/tickets');
      if (!res.ok) throw new Error('ไม่สามารถโหลดรายการตั๋วช่วยเหลือได้');
      return res.json();
    },
    enabled: status === 'authenticated',
    refetchInterval: 4000, // อัปเดตรายชื่อตั๋วอัตโนมัติทุก 4 วินาที
  });

  // 2. Query: Ticket Messages
  const { data: messages = [], isLoading: messagesLoading } = useQuery({
    queryKey: ['ticket-messages', selectedTicketId],
    queryFn: async () => {
      const res = await fetch(`/api/support/tickets/messages?ticketId=${selectedTicketId}`);
      if (!res.ok) throw new Error('ไม่สามารถโหลดข้อความสนทนาได้');
      return res.json();
    },
    enabled: !!selectedTicketId,
    refetchInterval: 2000, // โหลดข้อความสนทนาล่าสุดทุก 2 วินาที (เรียลไทม์)
  });

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const selectedTicket = tickets.find(t => t._id === selectedTicketId);

  // 3. Mutation: Create Ticket
  const createTicketMutation = useMutation({
    mutationFn: async (payload) => {
      const res = await fetch('/api/support/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'เปิดตั๋วคำร้องล้มเหลว');
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['user-tickets'] });
      setSelectedTicketId(data.ticket._id);
      setCreateModalOpen(false);
      setNewTitle('');
      setNewCategory('product');
      setNewDescription('');
      setSelectedTxId('');
      setIsRefundRequested(false);
      setFormError('');
    },
    onError: (err) => {
      setFormError(err.message);
    }
  });

  // 4. Mutation: Send Reply message
  const sendReplyMutation = useMutation({
    mutationFn: async (payload) => {
      const res = await fetch('/api/support/tickets/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'ส่งข้อความล้มเหลว');
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ticket-messages', selectedTicketId] });
      queryClient.invalidateQueries({ queryKey: ['user-tickets'] });
      setReplyMessage('');
      setReplyError('');
    },
    onError: (err) => {
      setReplyError(err.message);
    }
  });

  // 5. Mutation: Close Ticket
  const closeTicketMutation = useMutation({
    mutationFn: async (ticketId) => {
      const res = await fetch('/api/support/tickets/status', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticketId, status: 'closed' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'อัปเดตตั๋วช่วยเหลือล้มเหลว');
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-tickets'] });
      queryClient.invalidateQueries({ queryKey: ['ticket-messages', selectedTicketId] });
    }
  });

  const handleCreateTicketSubmit = (e) => {
    e.preventDefault();
    setFormError('');
    if (!newTitle.trim() || !newDescription.trim()) {
      setFormError('กรุณากรอกหัวข้อและคำอธิบายปัญหาให้ครบถ้วน');
      return;
    }

    let finalDescription = newDescription;
    if (selectedTxId) {
      finalDescription = `[คำร้องขอคืนเงิน: ${isRefundRequested ? 'ใช่' : 'ไม่ใช่'}]\n[Transaction ID: ${selectedTxId}]\n\n${finalDescription}`;
    }

    createTicketMutation.mutate({
      title: newTitle,
      category: newCategory,
      description: finalDescription,
    });
  };

  const handleSendReply = (e) => {
    e.preventDefault();
    setReplyError('');
    if (!replyMessage.trim()) return;
    sendReplyMutation.mutate({
      ticketId: selectedTicketId,
      message: replyMessage,
    });
  };

  const getCategoryLabel = (cat) => {
    switch (cat) {
      case 'product': return 'ปัญหาเกี่ยวกับสินค้า';
      case 'topup': return 'ปัญหาการเติมเงิน';
      case 'gacha': return 'กิจกรรมสุ่มกาชา';
      default: return 'ติดต่อสอบถามทั่วไป';
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'open':
        return <span className="px-2.5 py-0.5 rounded-lg text-[10px] font-black bg-amber-500/10 border border-amber-500/20 text-amber-400">รอการตรวจสอบ</span>;
      case 'replied':
        return <span className="px-2.5 py-0.5 rounded-lg text-[10px] font-black bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">ตอบกลับแล้ว</span>;
      case 'closed':
        return <span className="px-2.5 py-0.5 rounded-lg text-[10px] font-black bg-zinc-800 border border-white/5 text-zinc-500">ปิดคำร้องแล้ว</span>;
      default:
        return null;
    }
  };

  // Filter transactions based on selected category in the form
  const eligibleTransactions = userTransactions.filter(tx => {
    if (tx.status !== 'completed') return false;
    if (newCategory === 'product') {
      return tx.type === 'purchase' && !tx.description.includes('Gacha');
    }
    if (newCategory === 'gacha') {
      return tx.type === 'purchase' && tx.description.includes('Gacha');
    }
    if (newCategory === 'topup') {
      return tx.type === 'topup';
    }
    return false;
  });

  // Extract linked transaction details for the active chat header
  let linkedTx = null;
  let isRefundReq = false;
  if (selectedTicket) {
    const txIdMatch = selectedTicket.description?.match(/Transaction ID:\s*([a-f0-9\-]{36})/i);
    isRefundReq = selectedTicket.description?.includes('[คำร้องขอคืนเงิน: ใช่]');
    if (txIdMatch) {
      const linkedTxId = txIdMatch[1];
      linkedTx = userTransactions.find(t => t._id === linkedTxId || t.id === linkedTxId);
    }
  }

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex flex-col justify-center items-center bg-[#02060d] text-zinc-400">
        <Loader2 className="w-8 h-8 animate-spin text-sky-400" />
        <span className="text-xs mt-2">กำลังโหลดข้อมูลหน้าตั๋วช่วยเหลือ...</span>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen flex flex-col bg-[#02060d]">
      <CanvasBackground />
      <Navbar />

      <main className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-12 flex-1 flex flex-col relative z-10 space-y-6">
        
        {/* Breadcrumb / Title */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-white/5 pb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black bg-gradient-to-r from-sky-400 via-blue-500 to-purple-500 bg-clip-text text-transparent leading-normal flex items-center gap-2">
              <MessageSquare className="w-7 h-7 text-sky-400" />
              ศูนย์บริการลูกค้า & แจ้งปัญหาหลังการขาย
            </h1>
            <p className="text-xs text-zinc-400">
              แจ้งปัญหาคีย์ใช้งานไม่ได้ ยอดเงินไม่เข้าระเบียบ หรือขอคืนเครดิต แอดมินและฝ่ายบริการลูกค้าของ NakataShop พร้อมดูแลคุณ 24 ชั่วโมง
            </p>
          </div>
          {status === 'authenticated' && (
            <button
              onClick={() => setCreateModalOpen(true)}
              className="inline-flex items-center justify-center gap-1.5 bg-sky-500 text-sky-950 font-bold px-5 py-3 rounded-xl hover:bg-sky-400 transition-all text-xs glow-btn cursor-pointer shadow-lg shadow-sky-500/10"
            >
              <Plus className="w-4 h-4" />
              เปิดตั๋วคำร้องใหม่
            </button>
          )}
        </div>

        {status !== 'authenticated' ? (
          /* NOT LOGGED IN STATE */
          <div className="flex-1 flex flex-col items-center justify-center text-center p-12 bg-zinc-950/40 border border-white/5 rounded-3xl backdrop-blur-md min-h-[400px] space-y-4 shadow-xl">
            <AlertCircle className="w-12 h-12 text-zinc-600" />
            <div className="space-y-1">
              <h2 className="text-base font-bold text-zinc-300">เข้าสู่ระบบเพื่อติดต่อเจ้าหน้าที่</h2>
              <p className="text-xs text-zinc-500">กรุณาเข้าสู่ระบบก่อนเปิดเรื่องช่วยเหลือ เพื่ออ้างอิงกับประวัติบัญชีการซื้อขายของคุณได้อย่างแม่นยำ</p>
            </div>
            <Link
              href="/auth/signin"
              className="bg-sky-500 text-sky-950 px-6 py-3 rounded-xl text-xs font-bold hover:bg-sky-400 transition-all shadow-md shadow-sky-500/10"
            >
              เข้าสู่ระบบสมาชิก
            </Link>
          </div>
        ) : (
          /* LOGGED IN ACTIVE SCREEN */
          <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch min-h-[500px]">
            
            {/* 1. Ticket list sidebar (Visible on mobile only if no ticket selected) */}
            <div className={`space-y-3 lg:block ${selectedTicketId ? 'hidden' : 'block'}`}>
              <div className="bg-zinc-950/40 border border-white/5 p-4 rounded-2xl backdrop-blur-md">
                <span className="text-xs font-bold text-white block">รายการตั๋วคำร้องของคุณ ({tickets.length})</span>
                <span className="text-[10px] text-zinc-500">เลือกตั๋วเพื่อเปิดตรวจสอบข้อความโต้ตอบ</span>
              </div>

              <div className="space-y-2 overflow-y-auto max-h-[550px] pr-1">
                {ticketsLoading ? (
                  <div className="text-center py-10 text-xs text-zinc-500 flex flex-col items-center gap-2">
                    <Loader2 className="w-5 h-5 animate-spin text-sky-400" />
                    <span>กำลังโหลดตั๋วคำร้อง...</span>
                  </div>
                ) : tickets.length === 0 ? (
                  <div className="bg-zinc-950/20 p-8 text-center text-zinc-500 rounded-3xl border border-white/5 text-[11px] backdrop-blur-md">
                    คุณยังไม่เคยเปิดประวัติแจ้งคำร้องช่วยเหลือใดๆ
                  </div>
                ) : (
                  tickets.map((ticket) => (
                    <button
                      key={ticket._id}
                      onClick={() => setSelectedTicketId(ticket._id)}
                      className={`w-full text-left p-4 rounded-3xl border transition-all cursor-pointer block space-y-2.5 shadow-md ${
                        selectedTicketId === ticket._id 
                          ? 'bg-sky-500/5 border-sky-500/25 text-white' 
                          : 'bg-zinc-950/40 border-white/5 text-zinc-400 hover:bg-zinc-900/40 hover:text-white'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] bg-[#03060d] px-2 py-0.5 rounded-lg font-bold border border-white/5 text-zinc-400">
                          {getCategoryLabel(ticket.category)}
                        </span>
                        {getStatusBadge(ticket.status)}
                      </div>
                      <h3 className="text-xs font-bold truncate leading-snug">{ticket.title}</h3>
                      <div className="flex justify-between items-center text-[9px] text-zinc-500 font-sans border-t border-white/5 pt-2">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {new Date(ticket.createdAt).toLocaleDateString('th-TH')}
                        </span>
                        <span>#{ticket._id.substring(0, 8).toUpperCase()}</span>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>

            {/* 2. Chat Live panel (Visible on mobile only if a ticket is selected) */}
            <div className={`lg:col-span-2 flex flex-col border border-white/5 rounded-3xl bg-zinc-950/30 backdrop-blur-md overflow-hidden shadow-xl ${selectedTicketId ? 'flex' : 'hidden lg:flex items-center justify-center text-center p-12'}`}>
              {selectedTicketId && selectedTicket ? (
                <>
                  {/* Chat header */}
                  <div className="p-4 border-b border-white/5 bg-zinc-950/45 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setSelectedTicketId(null)}
                        className="lg:hidden p-2 rounded-xl border border-white/5 text-zinc-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer mr-1"
                      >
                        <ArrowLeft className="w-4 h-4" />
                      </button>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h2 className="text-xs font-bold text-white">{selectedTicket.title}</h2>
                          {getStatusBadge(selectedTicket.status)}
                        </div>
                        <span className="text-[9px] text-zinc-500 block font-sans mt-0.5">หมวดหมู่: {getCategoryLabel(selectedTicket.category)} • ตั๋วไอดี: #{selectedTicket._id}</span>
                      </div>
                    </div>

                    {selectedTicket.status !== 'closed' && (
                      <button
                        onClick={() => {
                          if (window.confirm('คุณแน่ใจหรือไม่ว่าต้องการปิดตั๋วบริการเรื่องนี้? (เมื่อปิดแล้วจะไม่สามารถส่งแชทเพิ่มได้)')) {
                            closeTicketMutation.mutate(selectedTicket._id);
                          }
                        }}
                        disabled={closeTicketMutation.isPending}
                        className="text-[9px] font-bold bg-[#030712] border border-white/5 hover:border-red-500/20 text-zinc-400 hover:text-red-400 px-3 py-2 rounded-xl transition-all cursor-pointer disabled:opacity-50"
                      >
                        {closeTicketMutation.isPending ? 'กำลังบันทึก...' : 'ปิดตั๋วปัญหานี้'}
                      </button>
                    )}
                  </div>

                  {/* Chat message box log */}
                  <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-[300px] max-h-[420px]">
                    
                    {/* Linked Transaction Summary Box */}
                    {linkedTx && (
                      <div className="bg-[#0b1424]/80 border border-sky-500/15 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 backdrop-blur-md shadow-md animate-[fadeIn_0.3s_ease-out]">
                        <div className="space-y-1">
                          <span className="text-[8px] bg-sky-500/10 text-sky-400 border border-sky-500/20 px-2 py-0.5 rounded font-black uppercase tracking-wider block w-max">ธุรกรรมอ้างอิง</span>
                          <h4 className="text-xs font-bold text-white leading-normal truncate max-w-[280px] sm:max-w-sm pt-1">
                            {linkedTx.description.split('\n')[0]}
                          </h4>
                          <p className="text-[10px] text-zinc-400 font-mono">
                            ยอดเงิน: {Math.abs(linkedTx.amount).toLocaleString()} THB · วันที่: {new Date(linkedTx.createdAt).toLocaleDateString('th-TH')}
                          </p>
                        </div>
                        {isRefundReq && (
                          <div className="shrink-0 flex items-center">
                            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-[10px] font-black border ${
                              selectedTicket.status === 'closed'
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                : 'bg-amber-500/10 text-amber-400 border-amber-500/25 animate-pulse'
                            }`}>
                              {selectedTicket.status === 'closed' ? 'คืนเงินสำเร็จแล้ว' : 'ขอเงินคืน (กำลังตรวจสอบ)'}
                            </span>
                          </div>
                        )}
                      </div>
                    )}

                    {messagesLoading ? (
                      <div className="h-full flex flex-col items-center justify-center text-xs text-zinc-500 gap-1.5 py-12">
                        <Loader2 className="w-6 h-6 animate-spin text-sky-400" />
                        <span>กำลังดึงข้อความสนทนาล่าสุด...</span>
                      </div>
                    ) : (
                      messages.map((msg) => {
                        const isSelf = msg.user_id === session.user.id && !msg.is_admin_reply;
                        const isSystem = msg.message?.startsWith('🤖 ระบบ:');

                        if (isSystem) {
                          return (
                            <div key={msg._id} className="flex justify-center items-center py-2.5 animate-in fade-in-30">
                              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-full px-5 py-2 text-[10px] text-emerald-400 font-bold tracking-wide shadow-lg shadow-emerald-500/5">
                                {msg.message}
                              </div>
                            </div>
                          );
                        }

                        return (
                          <div 
                            key={msg._id} 
                            className={`flex flex-col max-w-[75%] space-y-1 ${
                              isSelf ? 'ml-auto items-end' : 'mr-auto items-start'
                            }`}
                          >
                            <div className="flex items-center gap-1.5 text-[9px] text-zinc-500 font-sans">
                              {msg.is_admin_reply && <Shield className="w-3 h-3 text-purple-400" />}
                              <span className={msg.is_admin_reply ? 'text-purple-400 font-bold' : ''}>
                                {msg.is_admin_reply ? 'เจ้าหน้าที่แอดมิน' : msg.user?.username || 'คุณ'}
                              </span>
                              <span>•</span>
                              <span className="font-mono">{new Date(msg.createdAt).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                            <div className={`p-3.5 rounded-2xl text-xs break-all leading-relaxed whitespace-pre-wrap shadow-md ${
                              isSelf 
                                ? 'bg-gradient-to-br from-sky-500 to-sky-600 text-sky-950 rounded-tr-none font-bold shadow-sky-500/10' 
                                : msg.is_admin_reply 
                                  ? 'bg-[#0f0b18] border border-purple-500/20 text-purple-200 rounded-tl-none font-semibold shadow-purple-500/5'
                                  : 'bg-zinc-900 border border-white/5 text-zinc-200 rounded-tl-none'
                            }`}>
                              {msg.message}
                            </div>
                          </div>
                        );
                      })
                    )}
                    <div ref={messagesEndRef} />
                  </div>

                  {/* Chat input box */}
                  <div className="p-4 border-t border-white/5 bg-zinc-950/45">
                    {selectedTicket.status === 'closed' ? (
                      <div className="p-3.5 bg-zinc-900/60 border border-white/5 rounded-2xl text-center text-xs text-zinc-500 font-sans">
                        🔒 ตั๋วบริการช่วยเหลือนี้ถูกปิดแล้ว เนื่องจากได้รับข้อยุติหรือดำเนินการคืนเงินเรียบร้อย
                      </div>
                    ) : (
                      <form onSubmit={handleSendReply} className="space-y-2">
                        {replyError && (
                          <span className="text-[10px] text-red-400 font-sans block">{replyError}</span>
                        )}
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={replyMessage}
                            onChange={(e) => setReplyMessage(e.target.value)}
                            placeholder="พิมพ์ข้อความตอบกลับหรือสอบถามแอดมินเพิ่มเติม..."
                            className="flex-1 bg-[#03060d] border border-white/5 px-4 py-3.5 rounded-xl text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-sky-500/30 transition-all font-sans"
                            disabled={sendReplyMutation.isPending}
                          />
                          <button
                            type="submit"
                            disabled={sendReplyMutation.isPending || !replyMessage.trim()}
                            className="bg-sky-500 text-sky-950 font-bold px-5 rounded-xl hover:bg-sky-400 transition-colors disabled:opacity-50 cursor-pointer flex items-center justify-center shrink-0"
                          >
                            {sendReplyMutation.isPending ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Send className="w-4.5 h-4.5" />
                            )}
                          </button>
                        </div>
                      </form>
                    )}
                  </div>
                </>
              ) : (
                /* CHAT PLACEHOLDER SCREEN */
                <div className="space-y-3 py-24 text-center">
                  <Ticket className="w-12 h-12 stroke-[1.2] text-zinc-700 mx-auto" />
                  <div>
                    <h3 className="text-xs font-bold text-zinc-400">ยังไม่มีการเลือกห้องสนทนา</h3>
                    <p className="text-[10px] text-zinc-500">กรุณาคลิกเลือกตั๋วคำร้องด้านซ้าย หรือกดปุ่มเปิดตั๋วใหม่ด้านบนเพื่อคุยกับฝ่ายเทคนิค</p>
                  </div>
                </div>
              )}
            </div>

          </div>
        )}
      </main>

      <Footer />

      {/* CREATE NEW TICKET MODAL */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-xs font-sans">
          <div className="absolute inset-0" onClick={() => setCreateModalOpen(false)} />
          <div className="relative w-full max-w-lg bg-[#060c13] border border-white/5 p-6 rounded-2xl shadow-2xl glass z-10 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <button
              onClick={() => setCreateModalOpen(false)}
              className="absolute top-4 right-4 p-1 rounded-lg border border-white/5 text-zinc-400 hover:text-white hover:bg-white/5 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="mb-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                <Ticket className="w-4.5 h-4.5 text-sky-400" />
                <span>เปิดส่งรายงานแจ้งปัญหาการชำระเงิน/สินค้า</span>
              </h3>
              <p className="text-[10px] text-zinc-500">แอดมิน NakataShop จะเร่งตรวจสอบและแก้ปัญหาของท่านโดยด่วนที่สุด</p>
            </div>

            {formError && (
              <div className="bg-red-500/10 border border-red-500/20 px-3 py-2 rounded-lg text-xs text-red-400 flex items-center gap-1.5 mb-3">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleCreateTicketSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[11px] text-zinc-400 font-semibold block">หมวดหมู่ปัญหา *</label>
                <select
                  value={newCategory}
                  onChange={(e) => {
                    setNewCategory(e.target.value);
                    setSelectedTxId('');
                    setIsRefundRequested(false);
                  }}
                  className="w-full bg-[#03060d] border border-white/5 px-3.5 py-2.5 rounded-xl text-xs text-white focus:outline-none focus:border-sky-500 font-sans"
                >
                  <option value="product">ปัญหาเกี่ยวกับสินค้า (คีย์การ์ด / บัญชีสตรีมมิ่ง)</option>
                  <option value="topup">ปัญหาเกี่ยวกับการเติมเงิน (ยอดเงินไม่เข้า)</option>
                  <option value="gacha">ปัญหาเกี่ยวกับรางวัลกิจกรรมกาชา</option>
                  <option value="other">สอบถามข้อมูลอื่นๆ</option>
                </select>
              </div>

              {/* Linked Transaction Dropdown (Visible if eligible) */}
              {newCategory !== 'other' && (
                <div className="space-y-1">
                  <label className="text-[11px] text-zinc-400 font-semibold block">
                    เชื่อมโยงกับธุรกรรมประวัติ * {userTransactions.length === 0 && <span className="text-[9px] text-zinc-600">(ไม่มีประวัติ)</span>}
                  </label>
                  <select
                    value={selectedTxId}
                    onChange={(e) => {
                      setSelectedTxId(e.target.value);
                      setIsRefundRequested(false);
                    }}
                    className="w-full bg-[#03060d] border border-white/5 px-3.5 py-2.5 rounded-xl text-xs text-white focus:outline-none focus:border-sky-500 font-sans"
                  >
                    <option value="">-- ไม่เชื่อมโยง (แจ้งเรื่องทั่วไป) --</option>
                    {eligibleTransactions.map(tx => (
                      <option key={tx._id || tx.id} value={tx._id || tx.id}>
                        {new Date(tx.createdAt).toLocaleDateString('th-TH')} - {tx.description.split('\n')[0]} ({Math.abs(tx.amount)} THB)
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Selected Transaction Summary */}
              {selectedTxId && (
                <div className="bg-[#03060d] border border-white/5 rounded-xl p-3.5 space-y-1 animate-[fadeIn_0.2s_ease-out]">
                  {(() => {
                    const tx = userTransactions.find(t => t._id === selectedTxId || t.id === selectedTxId);
                    if (!tx) return null;
                    return (
                      <>
                        <p className="text-[10px] text-zinc-300 font-bold truncate">{tx.description.split('\n')[0]}</p>
                        <div className="flex justify-between text-[9px] text-zinc-500 font-mono">
                          <span>ยอดเงิน: {Math.abs(tx.amount).toLocaleString()} THB</span>
                          <span>ไอดี: #{tx._id?.substring(0, 8) || tx.id?.substring(0, 8)}</span>
                        </div>
                      </>
                    );
                  })()}
                </div>
              )}

              {/* Wallet Refund request checkbox */}
              {selectedTxId && newCategory !== 'topup' && (
                <div className="flex items-center gap-2 bg-amber-500/5 border border-amber-500/10 p-3 rounded-xl animate-[fadeIn_0.2s_ease-out]">
                  <input
                    type="checkbox"
                    id="requestRefund"
                    checked={isRefundRequested}
                    onChange={(e) => setIsRefundRequested(e.target.checked)}
                    className="w-4 h-4 rounded accent-amber-500 cursor-pointer"
                  />
                  <label htmlFor="requestRefund" className="text-[10px] text-amber-400 font-extrabold select-none cursor-pointer">
                    ต้องการยื่นเรื่องขอเงินคืน (Wallet Refund) สำหรับคีย์เสียรายการนี้
                  </label>
                </div>
              )}

              <div className="space-y-1">
                <label className="text-[11px] text-zinc-400 font-semibold block">หัวข้อเรื่องร้องเรียน *</label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="เช่น รหัสบัตรสตรีมมิ่งที่ซื้อใช้งานไม่ได้ครับ"
                  className="w-full bg-[#03060d] border border-white/5 px-3.5 py-2.5 rounded-xl text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-sky-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] text-zinc-400 font-semibold block">รายละเอียดปัญหาเพิ่มเติม *</label>
                <textarea
                  required
                  rows={3}
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="กรุณากรอกอาการปัญหาโดยละเอียด เพื่อให้ฝ่ายเทคนิคเร่งทำการเคลมและแก้ไขให้ได้อย่างรวดเร็ว"
                  className="w-full bg-[#03060d] border border-white/5 px-3.5 py-2.5 rounded-xl text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-sky-500 resize-none font-sans"
                />
              </div>

              <button
                type="submit"
                disabled={createTicketMutation.isPending}
                className="w-full flex items-center justify-center gap-1.5 bg-sky-500 text-sky-950 font-bold py-3.5 rounded-xl hover:bg-sky-400 transition-all text-xs glow-btn disabled:opacity-50 cursor-pointer"
              >
                {createTicketMutation.isPending ? (
                  <Loader2 className="w-4.5 h-4.5 animate-spin" />
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    <span>ยืนยันและเปิดส่งตั๋วรายงานเรื่อง</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function TicketsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex flex-col justify-center items-center bg-[#02060d] text-zinc-400">
        <Loader2 className="w-8 h-8 animate-spin text-sky-400" />
        <span className="text-xs mt-2">กำลังโหลดข้อมูลหน้าตั๋วช่วยเหลือ...</span>
      </div>
    }>
      <TicketsPageContent />
    </Suspense>
  );
}
