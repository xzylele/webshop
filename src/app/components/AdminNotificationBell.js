'use client';

import { useState, useRef, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import {
  Bell, Ticket, MessageSquare, Wallet, ShoppingBag, AlertCircle, Loader2, CheckCheck,
} from 'lucide-react';

const TYPE_CONFIG = {
  new_ticket: { icon: Ticket, color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
  ticket_reply: { icon: MessageSquare, color: 'text-sky-400 bg-sky-500/10 border-sky-500/20' },
  topup: { icon: Wallet, color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
  purchase: { icon: ShoppingBag, color: 'text-purple-400 bg-purple-500/10 border-purple-500/20' },
  low_stock: { icon: AlertCircle, color: 'text-red-400 bg-red-500/10 border-red-500/20' },
};

function formatTimeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'เมื่อสักครู่';
  if (minutes < 60) return `${minutes} นาทีที่แล้ว`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ชม. ที่แล้ว`;
  const days = Math.floor(hours / 24);
  return `${days} วันที่แล้ว`;
}

export default function AdminNotificationBell() {
  const { data: session } = useSession();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const panelRef = useRef(null);

  const isAdmin = session?.user?.role === 'admin';

  const { data, isLoading } = useQuery({
    queryKey: ['admin-notifications'],
    queryFn: async () => {
      const res = await fetch('/api/admin/notifications');
      if (!res.ok) throw new Error('Failed to load notifications');
      return res.json();
    },
    enabled: isAdmin,
    refetchInterval: 15000,
  });

  const markReadMutation = useMutation({
    mutationFn: async (payload) => {
      const res = await fetch('/api/admin/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Failed to update notification');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-notifications'] });
    },
  });

  useEffect(() => {
    function handleClickOutside(e) {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  if (!isAdmin) return null;

  const notifications = data?.notifications || [];
  const unreadCount = data?.unreadCount || 0;

  const handleNotificationClick = (notification) => {
    if (!notification.is_read) {
      markReadMutation.mutate({ id: notification._id });
    }
    setOpen(false);
    if (notification.link) {
      router.push(notification.link);
    }
  };

  const handleMarkAllRead = () => {
    markReadMutation.mutate({ markAll: true });
  };

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => setOpen(!open)}
        title="การแจ้งเตือนแอดมิน"
        className="relative p-2 rounded-full border border-white/5 hover:border-sky-500/20 hover:bg-zinc-900/40 text-zinc-400 hover:text-sky-400 flex items-center justify-center active:scale-95 transition-all cursor-pointer"
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-red-500 text-white font-black rounded-full flex items-center justify-center text-[9px] animate-pulse">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-[#060c13] border border-white/10 rounded-2xl shadow-2xl z-[60] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 bg-zinc-950/60">
            <div>
              <h3 className="text-xs font-bold text-white">การแจ้งเตือน</h3>
              {unreadCount > 0 && (
                <p className="text-[10px] text-zinc-500 mt-0.5">{unreadCount} รายการยังไม่อ่าน</p>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                disabled={markReadMutation.isPending}
                className="flex items-center gap-1 text-[10px] font-bold text-sky-400 hover:text-sky-300 transition-colors cursor-pointer disabled:opacity-50"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                อ่านทั้งหมด
              </button>
            )}
          </div>

          <div className="max-h-[360px] overflow-y-auto">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-10 gap-2 text-zinc-500">
                <Loader2 className="w-5 h-5 animate-spin text-sky-400" />
                <span className="text-[11px]">กำลังโหลด...</span>
              </div>
            ) : notifications.length === 0 ? (
              <div className="py-10 text-center text-[11px] text-zinc-500">
                ยังไม่มีการแจ้งเตือน
              </div>
            ) : (
              notifications.map((notification) => {
                const config = TYPE_CONFIG[notification.type] || TYPE_CONFIG.purchase;
                const Icon = config.icon;

                return (
                  <button
                    key={notification._id}
                    onClick={() => handleNotificationClick(notification)}
                    className={`w-full text-left px-4 py-3 border-b border-white/5 hover:bg-white/5 transition-colors cursor-pointer flex gap-3 ${
                      !notification.is_read ? 'bg-sky-500/5' : ''
                    }`}
                  >
                    <div className={`shrink-0 w-8 h-8 rounded-lg border flex items-center justify-center ${config.color}`}>
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex-1 min-w-0 space-y-0.5">
                      <div className="flex items-center justify-between gap-2">
                        <p className={`text-[11px] font-bold truncate ${notification.is_read ? 'text-zinc-300' : 'text-white'}`}>
                          {notification.title}
                        </p>
                        {!notification.is_read && (
                          <span className="shrink-0 w-2 h-2 rounded-full bg-sky-400" />
                        )}
                      </div>
                      <p className="text-[10px] text-zinc-500 line-clamp-2 leading-relaxed">
                        {notification.message}
                      </p>
                      <p className="text-[9px] text-zinc-600">
                        {formatTimeAgo(notification.createdAt)}
                      </p>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
