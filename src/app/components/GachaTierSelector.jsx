'use client';

import { Ticket, Sparkles, Crown } from 'lucide-react';

const tierThemes = {
  normal: {
    activeClass: 'border-sky-400/80 bg-sky-950/20 shadow-[0_0_24px_rgba(56,189,248,0.2)]',
    inactiveClass: 'border-white/5 bg-white/[0.02] hover:border-sky-500/30 hover:bg-sky-500/[0.02]',
    priceClass: 'text-sky-400',
    icon: Ticket,
    glowBg: 'rgba(56, 189, 248, 0.05)',
  },
  premium: {
    activeClass: 'border-amber-400/80 bg-amber-950/20 shadow-[0_0_24px_rgba(245,158,11,0.25)]',
    inactiveClass: 'border-white/5 bg-white/[0.02] hover:border-amber-500/30 hover:bg-amber-500/[0.02]',
    priceClass: 'text-amber-400',
    icon: Sparkles,
    glowBg: 'rgba(245, 158, 11, 0.06)',
  },
  luxury: {
    activeClass: 'border-rose-400/80 bg-rose-950/20 shadow-[0_0_24px_rgba(244,63,94,0.3)]',
    inactiveClass: 'border-white/5 bg-white/[0.02] hover:border-rose-500/30 hover:bg-rose-500/[0.02]',
    priceClass: 'text-rose-400',
    icon: Crown,
    glowBg: 'rgba(244, 63, 94, 0.07)',
  },
};

const getTheme = (slug) => {
  return tierThemes[slug] || {
    activeClass: 'border-purple-400/80 bg-purple-950/20 shadow-[0_0_24px_rgba(167,139,250,0.2)]',
    inactiveClass: 'border-white/5 bg-white/[0.02] hover:border-purple-500/30 hover:bg-purple-500/[0.02]',
    priceClass: 'text-purple-400',
    icon: Ticket,
    glowBg: 'rgba(167, 139, 250, 0.05)',
  };
};

export default function GachaTierSelector({ tiers, selectedTierId, onSelect }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3" aria-label="เลือกระดับกาชา">
      {tiers.map(tier => {
        const selected = tier.id === selectedTierId;
        const theme = getTheme(tier.slug);
        const IconComponent = theme.icon;

        return (
          <button
            key={tier.id}
            type="button"
            aria-pressed={selected}
            onClick={() => onSelect(tier)}
            className={`group relative overflow-hidden rounded-2xl border p-5 text-left transition-all duration-300 cursor-pointer ${
              selected ? theme.activeClass : theme.inactiveClass
            }`}
            style={{
              backgroundImage: `radial-gradient(circle at top right, ${theme.glowBg}, transparent 60%)`
            }}
          >
            {/* Top Right Decorative Icon */}
            <div className={`absolute top-4 right-4 opacity-[0.08] transition-opacity duration-300 ${selected ? 'opacity-[0.18]' : 'group-hover:opacity-[0.15]'}`}>
              <IconComponent className="w-12 h-12" />
            </div>

            <div className="flex flex-col h-full justify-between space-y-3 relative z-10">
              <div>
                <span className="text-zinc-500 text-[9px] font-extrabold uppercase tracking-wider block">
                  GACHA TIER
                </span>
                <span className="font-extrabold text-base text-white tracking-tight flex items-center gap-1.5 mt-0.5">
                  {tier.name}
                </span>
              </div>

              <div>
                <span className={`text-lg font-black ${theme.priceClass} block`}>
                  {tier.price.toLocaleString()} THB
                </span>
              </div>

              <div className="flex items-center gap-2 pt-2 border-t border-white/5">
                {tier.isReady ? (
                  <>
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                    </span>
                    <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">
                      พร้อมสุ่ม
                    </span>
                  </>
                ) : (
                  <>
                    <span className="relative flex h-2 w-2">
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
                    </span>
                    <span className="text-[10px] font-bold text-rose-400 uppercase tracking-wider truncate max-w-[150px]" title={tier.reason}>
                      {tier.reason}
                    </span>
                  </>
                )}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
