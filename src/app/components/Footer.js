'use client';

export default function Footer({ onOpenContact }) {
  return (
    <footer className="w-full border-t border-white/5 bg-[#02060d] py-6 text-xs text-zinc-500 z-10 relative mt-auto">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-4">

        {/* Left Side Info */}
        <div className="flex flex-wrap items-center justify-center md:justify-start gap-2">
          <span>© 2026 NakataShop • All Rights Reserved.</span>
          <span>•</span>
          <span>Made with passion by</span>
          <a href="#" className="font-semibold text-zinc-400 hover:text-sky-400 transition-colors">Nakata Dev</a>
        </div>

        {/* Right Side Support Action */}
        <div>
          <button
            onClick={onOpenContact}
            className="hover:underline text-zinc-400 hover:text-sky-400 transition-colors cursor-pointer text-left font-medium"
          >
            ติดต่อร้านค้าไม่ได้ / ต้องการรายงานปัญหาร้านค้าฉ้อโกง?
          </button>
        </div>
      </div>
    </footer>
  );
}
