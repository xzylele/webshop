'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function PointShopRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/inventory?tab=point-shop');
  }, [router]);

  return (
    <div className="min-h-screen bg-[#02060d] text-zinc-500 flex flex-col items-center justify-center gap-3">
      <div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
      <span className="text-xs text-zinc-400 font-semibold">กำลังเปลี่ยนเส้นทางไปศูนย์พอยท์ช็อป...</span>
    </div>
  );
}
