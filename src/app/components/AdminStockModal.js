'use client';

import { useState } from 'react';
import { X, Plus, Loader2, AlertCircle, Trash2, Key, CheckCircle, HelpCircle } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export default function AdminStockModal({ isOpen, onClose, product }) {
  const queryClient = useQueryClient();
  const [codesInput, setCodesInput] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Fetch codes for this product
  const { data: codes = [], isLoading: codesLoading } = useQuery({
    queryKey: ['admin-product-codes', product?._id],
    queryFn: async () => {
      const res = await fetch(`/api/admin/products/stock?productId=${product._id}`);
      if (!res.ok) throw new Error('ไม่สามารถโหลดข้อมูลโค้ดได้');
      return res.json();
    },
    enabled: isOpen && !!product?._id,
  });

  // Mutation to add codes
  const addCodesMutation = useMutation({
    mutationFn: async (payload) => {
      const res = await fetch('/api/admin/products/stock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'เกิดข้อผิดพลาดในการนำเข้าโค้ด');
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['admin-product-codes', product?._id] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      setCodesInput('');
      setSuccessMsg(data.message || 'นำเข้าโค้ดคีย์สำเร็จแล้ว!');
      setTimeout(() => setSuccessMsg(''), 4000);
    },
    onError: (err) => {
      setErrorMsg(err.message);
    }
  });

  // Mutation to delete a code
  const deleteCodeMutation = useMutation({
    mutationFn: async (codeId) => {
      const res = await fetch(`/api/admin/products/stock?codeId=${codeId}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'ลบโค้ดล้มเหลว');
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-product-codes', product?._id] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
    onError: (err) => {
      alert(err.message);
    }
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!codesInput.trim()) {
      setErrorMsg('กรุณากรอกโค้ดอย่างน้อย 1 รหัส');
      return;
    }

    addCodesMutation.mutate({
      productId: product._id,
      codesInput,
    });
  };

  if (!isOpen || !product) return null;

  const unusedCount = codes.filter(c => !c.isUsed).length;
  const usedCount = codes.filter(c => c.isUsed).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm">
      <div className="absolute inset-0" onClick={onClose} />

      <div className="relative w-full max-w-2xl bg-[#060c13] border border-white/5 p-6 rounded-2xl shadow-2xl glass z-10 grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Left Side: Bulk import form */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <h2 className="text-sm font-bold text-white flex items-center gap-1.5">
                <Key className="w-4 h-4 text-sky-400" />
                <span>เติมสต็อกโค้ด / บัญชี</span>
              </h2>
              <p className="text-[10px] text-zinc-400">{product.name}</p>
            </div>
          </div>

          {errorMsg && (
            <div className="bg-red-500/10 border border-red-500/20 px-3 py-2 rounded-xl text-xs text-red-400 flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="bg-emerald-500/10 border border-emerald-500/20 px-3 py-2 rounded-xl text-xs text-emerald-400 flex items-center gap-1.5">
              <CheckCircle className="w-4 h-4 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="space-y-1">
              <label className="text-[11px] text-zinc-400 font-semibold block">
                ป้อนรหัสคีย์ (1 รหัสต่อ 1 บรรทัด)
              </label>
              <textarea
                value={codesInput}
                onChange={(e) => setCodesInput(e.target.value)}
                rows="8"
                className="w-full bg-[#03060d] border border-white/5 px-3 py-2 rounded-xl text-xs text-white placeholder-zinc-500 font-mono focus:outline-none focus:border-sky-500 resize-none"
                placeholder={`ตัวอย่าง:\nSTEAM-1111-2222\nSTEAM-3333-4444\nSTEAM-5555-6666`}
              />
            </div>

            <button
              type="submit"
              disabled={addCodesMutation.isPending}
              className="w-full flex items-center justify-center gap-1.5 bg-sky-500 text-sky-950 font-bold py-2.5 rounded-xl hover:bg-sky-400 transition-all text-xs glow-btn cursor-pointer"
            >
              {addCodesMutation.isPending ? (
                <Loader2 className="w-4.5 h-4.5 animate-spin" />
              ) : (
                <>
                  <Plus className="w-4.5 h-4.5" />
                  <span>บันทึกโค้ดเข้าคลัง</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* Right Side: Stock lists & Deletion */}
        <div className="flex flex-col h-[400px] border-t md:border-t-0 md:border-l border-white/5 pt-4 md:pt-0 md:pl-6 space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-white/5">
            <div>
              <h3 className="text-xs font-bold text-white">รหัสในคลังสต็อก ({codes.length})</h3>
              <p className="text-[9px] text-zinc-500">พร้อมขาย: {unusedCount} | ขายแล้ว: {usedCount}</p>
            </div>
            <button
              onClick={onClose}
              className="p-1 rounded-lg border border-white/5 text-zinc-400 hover:text-white hover:bg-white/5 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {codesLoading ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-2 text-[11px] text-zinc-500">
              <Loader2 className="w-5 h-5 animate-spin text-sky-400" />
              <span>กำลังดึงข้อมูลโค้ดสินค้า...</span>
            </div>
          ) : codes.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-xs text-zinc-500">
              ยังไม่มีโค้ดคีย์ในคลังสต็อก
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 font-mono text-[10px]">
              {codes.map((c) => (
                <div 
                  key={c._id} 
                  className={`flex items-center justify-between p-2 rounded-lg border bg-zinc-950/40 ${
                    c.isUsed 
                      ? 'border-zinc-800 text-zinc-500 opacity-60' 
                      : 'border-white/5 text-zinc-300'
                  }`}
                >
                  <div className="truncate pr-2">
                    <span className="block font-semibold truncate select-all">{c.code}</span>
                    {c.isUsed && c.usedBy && (
                      <span className="text-[8px] text-sky-400 block truncate">
                        ซื้อโดย: {c.usedBy.username}
                      </span>
                    )}
                  </div>

                  {!c.isUsed && (
                    <button
                      onClick={() => {
                        if (window.confirm('คุณต้องการลบโค้ดนี้ออกจากสต็อกหรือไม่?')) {
                          deleteCodeMutation.mutate(c._id);
                        }
                      }}
                      className="shrink-0 p-1 bg-zinc-900 border border-white/5 rounded text-zinc-400 hover:text-red-400 hover:border-red-500/25 cursor-pointer transition-colors"
                      title="ลบโค้ด"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
