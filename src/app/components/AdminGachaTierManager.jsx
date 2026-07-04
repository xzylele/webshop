'use client';

import { useState } from 'react';
import { Plus, Power, Trash2 } from 'lucide-react';

export default function AdminGachaTierManager({ tiers, selectedTierId, onSelect, onCreate, onUpdate, onDelete }) {
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');

  const submit = event => {
    event.preventDefault();
    if (!name.trim() || !(Number(price) > 0)) return;
    onCreate({ name: name.trim(), price: Number(price) });
    setName('');
    setPrice('');
  };

  return (
    <section className="glass rounded-2xl border border-white/5 p-4 space-y-4">
      <div>
        <h3 className="font-bold text-white">ระดับ Gacha</h3>
        <p className="text-[11px] text-zinc-500">เลือกระดับเพื่อจัดการรางวัลและเปอร์เซ็นต์</p>
      </div>

      <form onSubmit={submit} className="grid grid-cols-1 sm:grid-cols-[1fr_130px_auto] gap-2">
        <input aria-label="Tier name" value={name} onChange={event => setName(event.target.value)} placeholder="ชื่อระดับ" className="bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-xs text-white" />
        <input aria-label="Spin price" type="number" min="0.01" step="0.01" value={price} onChange={event => setPrice(event.target.value)} placeholder="ราคา" className="bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-xs text-white" />
        <button type="submit" className="bg-sky-500 text-sky-950 rounded-xl px-3 py-2 text-xs font-bold flex items-center justify-center gap-1 cursor-pointer">
          <Plus className="w-3.5 h-3.5" /> Add tier
        </button>
      </form>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {tiers.map(tier => (
          <div key={tier.id} className={`rounded-xl border p-3 ${tier.id === selectedTierId ? 'border-sky-400 bg-sky-500/10' : 'border-white/10 bg-black/20'}`}>
            <button type="button" onClick={() => onSelect(tier)} className="w-full text-left cursor-pointer">
              <span className="flex justify-between gap-2 text-white font-semibold">
                <span>{tier.name}</span><span>{tier.price.toLocaleString()} THB</span>
              </span>
              <span className={`mt-1 block text-xs font-bold ${tier.totalPercentage === 100 ? 'text-emerald-400' : 'text-amber-400'}`}>{tier.totalPercentage}/100%</span>
              <span className={`block text-[10px] ${tier.isReady ? 'text-emerald-400' : 'text-rose-400'}`}>{tier.isReady ? 'พร้อมสุ่ม' : tier.reason}</span>
            </button>
            <div className="mt-3 flex gap-2">
              <button type="button" onClick={() => onUpdate({ id: tier.id, isActive: !tier.isActive })} className="text-[10px] text-zinc-300 flex items-center gap-1 cursor-pointer">
                <Power className="w-3 h-3" /> {tier.isActive ? 'ปิด' : 'เปิด'}
              </button>
              <button type="button" onClick={() => onDelete(tier)} className="text-[10px] text-rose-400 flex items-center gap-1 cursor-pointer">
                <Trash2 className="w-3 h-3" /> ลบ
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
