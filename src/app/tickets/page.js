'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  MessageSquare, Plus, Send, X, Loader2, AlertCircle, 
  CheckCircle, Ticket, ArrowLeft, Shield, Calendar, HelpCircle 
} from 'lucide-react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import CanvasBackground from '../components/CanvasBackground';
import Link from 'next/link';

export default function TicketsPage() {
  const { data: session, status } = useSession();
  const queryClient = useQueryClient();

  const [selectedTicketId, setSelectedTicketId] = useState(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);

  // New ticket form state
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState('product'); // product | topup | gacha | other
  const [newDescription, setNewDescription] = useState('');
  const [formError, setFormError] = useState('');

  const [replyMessage, setReplyMessage] = useState('');
  const [replyError, setReplyError] = useState('');

  // Read query params for pre-filled report from inventory page
  const searchParams = useSearchParams();

  useEffect(() => {
    const isReport = searchParams.get('report');
    if (isReport === 'true' && status === 'authenticated') {
      const product = searchParams.get('product') || '';
      const desc = searchParams.get('desc') || '';
      const amount = searchParams.get('amount') || '';
      const txId = searchParams.get('txId') || '';
      setNewCategory('product');
      setNewTitle(`แจ้งปัญหาสินค้า: ${product}`);
      setNewDescription(`รายการที่มีปัญหา:\nสินค้า: ${product}\nรายละเอียดการซื้อ: ${desc}\nยอดเงิน: ${amount} THB\nTransaction ID: ${txId}\n\nรายละเอียดปัญหา: `);
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
  });

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
    createTicketMutation.mutate({
      title: newTitle,
      category: newCategory,
      description: newDescription,
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
      case 'gacha': return 'กิจกรรมสุ่มก๊าซา';
      default: return 'ติดต่อสอบถามทั่วไป';
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'open':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 border border-amber-500/20 text-amber-400">รอการตรวจสอบ</span>;
      case 'replied':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-sky-500/10 border border-sky-500/20 text-sky-400">ตอบกลับแล้ว</span>;
      case 'closed':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-zinc-500/10 border border-white/5 text-zinc-500">ปิดคำร้องแล้ว</span>;
      default:
        return null;
    }
  };

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
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-white glow-text flex items-center gap-2">
              <MessageSquare className="w-6 h-6 text-sky-400" />
              ศูนย์ตั๋วช่วยเหลือ / แจ้งปัญหาหลังการขาย
            </h1>
            <p className="text-xs text-zinc-400 mt-1">สามารถแจ้งเรื่อง ไอดีมีปัญหา เงินไม่เข้า หรือติดต่อสอบถามอื่นๆ แอดมินจะตอบกลับโดยเร็วที่สุด</p>
          </div>
          {status === 'authenticated' && (
            <button
              onClick={() => setCreateModalOpen(true)}
              className="inline-flex items-center justify-center gap-1.5 bg-sky-500 text-sky-950 font-bold px-4 py-2.5 rounded-xl hover:bg-sky-400 transition-all text-xs glow-btn cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              เปิดตั๋วช่วยเหลือใหม่
            </button>
          )}
        </div>

        {status !== 'authenticated' ? (
          /* NOT LOGGED IN STATE */
          <div className="flex-1 flex flex-col items-center justify-center text-center p-12 bg-zinc-950/40 border border-white/5 rounded-3xl backdrop-blur-md min-h-[400px] space-y-4">
            <AlertCircle className="w-12 h-12 text-zinc-700" />
            <div className="space-y-1">
              <h2 className="text-sm font-bold text-zinc-400">เข้าสู่ระบบเพื่อใช้งานระบบแจ้งเรื่องช่วยเหลือ</h2>
              <p className="text-[11px] text-zinc-500">กรุณาเข้าสู่ระบบก่อนเปิดคำร้องเรียนเพื่ออ้างอิงรหัสข้อมูลประวัติการซื้อของคุณ</p>
            </div>
            <Link
              href="/auth/signin"
              className="bg-sky-500 text-sky-950 px-6 py-2.5 rounded-xl text-xs font-bold hover:bg-sky-400 transition-all"
            >
              เข้าสู่ระบบทันที
            </Link>
          </div>
        ) : (
          /* LOGGED IN ACTIVE SCREEN */
          <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch min-h-[500px]">
            
            {/* 1. Ticket list sidebar (Visible on mobile only if no ticket selected) */}
            <div className={`space-y-3 lg:block ${selectedTicketId ? 'hidden' : 'block'}`}>
              <div className="bg-zinc-950/40 border border-white/5 p-4 rounded-2xl">
                <span className="text-xs font-bold text-white block">ตั๋วคำร้องทั้งหมดของคุณ ({tickets.length})</span>
                <span className="text-[10px] text-zinc-500">คลิกที่รายการตั๋วเพื่อเปิดอ่านสนทนาล่าสุด</span>
              </div>

              <div className="space-y-2 overflow-y-auto max-h-[550px] pr-1">
                {ticketsLoading ? (
                  <div className="text-center py-10 text-xs text-zinc-500 flex flex-col items-center gap-2">
                    <Loader2 className="w-5 h-5 animate-spin text-sky-400" />
                    <span>กำลังโหลดตั๋วคำร้อง...</span>
                  </div>
                ) : tickets.length === 0 ? (
                  <div className="glass p-8 text-center text-zinc-500 rounded-xl border border-white/5 text-[11px]">
                    คุณยังไม่มีการเปิดตั๋วช่วยเหลือในขณะนี้
                  </div>
                ) : (
                  tickets.map((ticket) => (
                    <button
                      key={ticket._id}
                      onClick={() => setSelectedTicketId(ticket._id)}
                      className={`w-full text-left p-4 rounded-2xl border transition-all cursor-pointer block space-y-2.5 ${
                        selectedTicketId === ticket._id 
                          ? 'bg-sky-500/5 border-sky-500/20 text-white shadow-lg' 
                          : 'bg-zinc-950/40 border-white/5 text-zinc-400 hover:bg-zinc-900/40 hover:text-white'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] bg-zinc-900 px-2 py-0.5 rounded font-bold border border-white/5 text-zinc-400">
                          {getCategoryLabel(ticket.category)}
                        </span>
                        {getStatusBadge(ticket.status)}
                      </div>
                      <h3 className="text-xs font-bold truncate leading-snug">{ticket.title}</h3>
                      <div className="flex justify-between items-center text-[9px] text-zinc-500 font-sans">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {new Date(ticket.createdAt).toLocaleDateString('th-TH')}
                        </span>
                        <span>#{ticket._id.substring(0, 8)}</span>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>

            {/* 2. Chat Live panel (Visible on mobile only if a ticket is selected) */}
            <div className={`lg:col-span-2 flex flex-col border border-white/5 rounded-3xl bg-zinc-950/30 backdrop-blur-md overflow-hidden ${selectedTicketId ? 'flex' : 'hidden lg:flex items-center justify-center text-center p-12'}`}>
              {selectedTicketId && selectedTicket ? (
                <>
                  {/* Chat header */}
                  <div className="p-4 border-b border-white/5 bg-zinc-950/40 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setSelectedTicketId(null)}
                        className="lg:hidden p-1 rounded-lg border border-white/5 text-zinc-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
                      >
                        <ArrowLeft className="w-4 h-4" />
                      </button>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h2 className="text-xs font-bold text-white">{selectedTicket.title}</h2>
                          {getStatusBadge(selectedTicket.status)}
                        </div>
                        <span className="text-[10px] text-zinc-500 block font-sans">หมวดหมู่: {getCategoryLabel(selectedTicket.category)} • ตั๋วไอดี: #{selectedTicket._id}</span>
                      </div>
                    </div>

                    {selectedTicket.status !== 'closed' && (
                      <button
                        onClick={() => {
                          if (window.confirm('คุณแน่ใจหรือไม่ว่าปัญหานี้ได้รับการแก้ไขแล้ว และต้องการปิดตั๋วคำร้องนี้?')) {
                            closeTicketMutation.mutate(selectedTicket._id);
                          }
                        }}
                        disabled={closeTicketMutation.isPending}
                        className="text-[10px] font-bold bg-zinc-900 border border-white/5 hover:border-red-500/20 text-zinc-400 hover:text-red-400 px-3 py-1.5 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                      >
                        {closeTicketMutation.isPending ? 'กำลังบันทึก...' : 'กดปิดคำร้องสำเร็จ'}
                      </button>
                    )}
                  </div>

                  {/* Chat message box log */}
                  <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-[300px] max-h-[400px]">
                    {messagesLoading ? (
                      <div className="h-full flex flex-col items-center justify-center text-xs text-zinc-500 gap-1.5 py-12">
                        <Loader2 className="w-6 h-6 animate-spin text-sky-400" />
                        <span>กำลังดึงข้อความพูดคุยล่าสุด...</span>
                      </div>
                    ) : (
                      messages.map((msg, index) => {
                        const isSelf = msg.user_id === session.user.id && !msg.is_admin_reply;
                        return (
                          <div 
                            key={msg._id} 
                            className={`flex flex-col max-w-[75%] space-y-1 ${
                              isSelf ? 'ml-auto items-end' : 'mr-auto items-start'
                            }`}
                          >
                            <div className="flex items-center gap-1.5 text-[9px] text-zinc-500 font-sans">
                              {msg.is_admin_reply && <Shield className="w-3 h-3 text-sky-400" />}
                              <span className={msg.is_admin_reply ? 'text-sky-400 font-bold' : ''}>
                                {msg.is_admin_reply ? 'แอดมินสนับสนุน' : msg.user?.username || 'คุณ'}
                              </span>
                              <span>•</span>
                              <span>{new Date(msg.createdAt).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                            <div className={`p-3 rounded-2xl text-xs break-all leading-relaxed whitespace-pre-wrap ${
                              isSelf 
                                ? 'bg-sky-500 text-sky-950 rounded-tr-none font-medium' 
                                : msg.is_admin_reply 
                                  ? 'bg-sky-950/30 border border-sky-500/20 text-sky-200 rounded-tl-none font-medium'
                                  : 'bg-zinc-900 border border-white/5 text-zinc-200 rounded-tl-none'
                            }`}>
                              {msg.message}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* Chat input box */}
                  <div className="p-4 border-t border-white/5 bg-zinc-950/40">
                    {selectedTicket.status === 'closed' ? (
                      <div className="p-3 bg-zinc-900 border border-white/5 rounded-xl text-center text-xs text-zinc-500 font-sans">
                        🔒 ตั๋วคำร้องนี้ได้รับการปิดการสนทนาเรียบร้อยแล้ว หากพบปัญหาใหม่กรุณาเปิดตั๋วฉบับใหม่
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
                            placeholder="พิมพ์ข้อความรายละเอียดเพื่อคุยกับแอดมิน..."
                            className="flex-1 bg-[#03060d] border border-white/5 px-4 py-3 rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-sky-500/30 font-sans"
                            disabled={sendReplyMutation.isPending}
                          />
                          <button
                            type="submit"
                            disabled={sendReplyMutation.isPending || !replyMessage.trim()}
                            className="bg-sky-500 text-sky-950 font-bold px-4 rounded-xl hover:bg-sky-400 transition-colors disabled:opacity-50 cursor-pointer flex items-center justify-center shrink-0"
                          >
                            {sendReplyMutation.isPending ? (
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
              ) : (
                /* CHAT PLACEHOLDER SCREEN */
                <div className="space-y-3 py-16">
                  <Ticket className="w-12 h-12 stroke-[1.2] text-zinc-700 mx-auto" />
                  <div>
                    <h3 className="text-xs font-bold text-zinc-400">ยังไม่มีการเลือกตั๋วสนทนา</h3>
                    <p className="text-[10px] text-zinc-500">กรุณาเลือกประวัติเรื่องร้องเรียนจากทางฝั่งซ้าย เพื่อเปิดอ่านรายละเอียด</p>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs font-sans">
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
                <span>เปิดตั๋วช่วยเหลือแจ้งเรื่องใหม่</span>
              </h3>
              <p className="text-[10px] text-zinc-500">กรอกข้อมูลปัญหาที่คุณพบล่าสุดเพื่อให้แอดมินตรวจสอบ</p>
            </div>

            {formError && (
              <div className="bg-red-500/10 border border-red-500/20 px-3 py-2 rounded-lg text-xs text-red-400 flex items-center gap-1.5 mb-3">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleCreateTicketSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[11px] text-zinc-400 font-semibold block">หัวข้อเรื่องร้องเรียน *</label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="เช่น ยอดเงินหลังเติมไม่เพิ่มครับ หรือ ไอดี Netflix ถูกเปลี่ยนพาส"
                  className="w-full bg-[#03060d] border border-white/5 px-3.5 py-2.5 rounded-xl text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-sky-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] text-zinc-400 font-semibold block">หมวดหมู่ปัญหา *</label>
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  className="w-full bg-[#03060d] border border-white/5 px-3.5 py-2.5 rounded-xl text-xs text-white focus:outline-none focus:border-sky-500 font-sans"
                >
                  <option value="product">ปัญหาเกี่ยวกับสินค้า (คีย์ใช้ไม่ได้ / ไอดีติดปัญหา)</option>
                  <option value="topup">ปัญหาเกี่ยวกับการเติมเงิน (โอนเงินแล้วยอดเงินไม่ขึ้น)</option>
                  <option value="gacha">ปัญหาเกี่ยวกับกิจกรรมวงล้อก๊าซา</option>
                  <option value="other">สอบถามข้อมูล/แจ้งเรื่องอื่นๆ</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] text-zinc-400 font-semibold block">คำอธิบายรายละเอียดปัญหาทั้งหมด *</label>
                <textarea
                  required
                  rows={4}
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="กรุณากรอกข้อมูลปัญหาโดยละเอียด เช่น ชื่อบัญชี Netflix ที่พบล่าสุด, เลขรหัสสติกเกอร์ Topup อ้างอิง หรืออาการเสียต่างๆ เพื่อความรวดเร็วในการดูแล"
                  className="w-full bg-[#03060d] border border-white/5 px-3.5 py-2.5 rounded-xl text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-sky-500 resize-none font-sans"
                />
              </div>

              <button
                type="submit"
                disabled={createTicketMutation.isPending}
                className="w-full flex items-center justify-center gap-1.5 bg-sky-500 text-sky-950 font-bold py-3 rounded-xl hover:bg-sky-400 transition-all text-xs glow-btn disabled:opacity-50 cursor-pointer"
              >
                {createTicketMutation.isPending ? (
                  <Loader2 className="w-4.5 h-4.5 animate-spin" />
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    <span>ยืนยันการเปิดเรื่องแจ้งปัญหา</span>
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
