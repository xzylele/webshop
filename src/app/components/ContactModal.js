'use client';

import { X, MessageSquare, Mail, MessageCircle, Send } from 'lucide-react';

export default function ContactModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      {/* Backdrop click */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Modal Box */}
      <div className="relative w-full max-w-md bg-[#060c13] border border-white/5 p-6 rounded-2xl shadow-2xl glass z-10 transition-all animate-in fade-in zoom-in-95 duration-200">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg border border-white/5 text-zinc-400 hover:text-white hover:bg-white/5 cursor-pointer transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="bg-sky-500/10 p-2.5 rounded-xl text-sky-400">
            <MessageSquare className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white leading-tight">ติดต่อฝ่ายสนับสนุน</h2>
            <p className="text-xs text-zinc-400">บริการช่วยเหลือทุกวันตลอด 24 ชั่วโมง</p>
          </div>
        </div>

        {/* Channels List */}
        <div className="space-y-3">
          {/* Discord */}
          <a
            href="https://rdcw.co.th/discord"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-4 bg-[#5865F2]/10 hover:bg-[#5865F2]/20 border border-[#5865F2]/20 p-4 rounded-xl transition-all group hover:scale-[0.99]"
          >
            <div className="bg-[#5865F2] text-white p-2 rounded-lg">
              <Send className="w-5 h-5 fill-white" />
            </div>
            <div className="text-left">
              <h3 className="text-sm font-semibold text-white group-hover:text-[#5865F2] transition-colors">
                Discord Community
              </h3>
              <p className="text-xs text-zinc-400">เข้าร่วมพูดคุย แจ้งปัญหา และรับโค้ดฟรี</p>
            </div>
          </a>

          {/* Messenger */}
          <a
            href="#"
            onClick={(e) => e.preventDefault()}
            className="flex items-center gap-4 bg-sky-500/5 hover:bg-sky-500/10 border border-sky-500/10 p-4 rounded-xl transition-all group hover:scale-[0.99]"
          >
            <div className="bg-gradient-to-r from-sky-400 to-blue-500 text-sky-950 p-2 rounded-lg">
              <MessageCircle className="w-5 h-5" />
            </div>
            <div className="text-left">
              <h3 className="text-sm font-semibold text-white group-hover:text-sky-400 transition-colors">
                Facebook Live Chat
              </h3>
              <p className="text-xs text-zinc-400">ติดต่อพูดคุยกับแอดมินเพจโดยตรง</p>
            </div>
          </a>

          {/* Email */}
          <a
            href="mailto:support@nakatashop.com"
            className="flex items-center gap-4 bg-emerald-500/5 hover:bg-emerald-500/10 border border-emerald-500/10 p-4 rounded-xl transition-all group hover:scale-[0.99]"
          >
            <div className="bg-emerald-500 text-emerald-950 p-2 rounded-lg">
              <Mail className="w-5 h-5" />
            </div>
            <div className="text-left">
              <h3 className="text-sm font-semibold text-white group-hover:text-emerald-400 transition-colors">
                Email Support
              </h3>
              <p className="text-xs text-zinc-400">support@nakatashop.com</p>
            </div>
          </a>
        </div>

        {/* Notice Info */}
        <div className="mt-6 p-3 bg-zinc-950/40 border border-white/5 rounded-lg text-[11px] text-zinc-500 leading-normal text-center">
          หากมีปัญหาร้านค้าขัดข้องหรือต้องการขอคืนเงิน (Refund) กรุณาเตรียมข้อมูลเลขทรานแซกชั่นเพื่อความสะดวกรวดเร็วในการเคลมสินค้า
        </div>

      </div>
    </div>
  );
}
