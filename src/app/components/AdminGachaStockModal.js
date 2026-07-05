'use client';

import { useState } from 'react';
import { X, Plus, Loader2, AlertCircle, Trash2, Edit2, Check, Key, History, HelpCircle } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';

export default function AdminGachaStockModal({ isOpen, onClose, gachaItem }) {
  const queryClient = useQueryClient();
  const [activeSubTab, setActiveSubTab] = useState('unused'); // unused | history
  const [newCodesInput, setNewCodesInput] = useState('');
  
  // Inline edit state
  const [editingIdx, setEditingIdx] = useState(null);
  const [editingVal, setEditingVal] = useState('');

  const [errorMsg, setErrorMsg] = useState('');

  const mutation = useMutation({
    mutationFn: async (payload) => {
      const res = await fetch('/api/admin/gacha', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: gachaItem._id, ...payload }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'เกิดข้อผิดพลาดในการบันทึกรหัส');
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-gacha'] });
      queryClient.invalidateQueries({ queryKey: ['admin-gacha-tiers'] });
      queryClient.invalidateQueries({ queryKey: ['admin-point-gacha'] });
      setNewCodesInput('');
      setEditingIdx(null);
      setEditingVal('');
      setErrorMsg('');
    },
    onError: (err) => {
      setErrorMsg(err.message);
    }
  });

  const handleAddCodes = (e) => {
    e.preventDefault();
    if (!newCodesInput.trim()) return;

    mutation.mutate({
      appendStockInput: newCodesInput
    });
  };

  const handleDeleteCode = (index) => {
    if (window.confirm('คุณแน่ใจว่าต้องการลบรหัสนี้ออกจากวงล้อสุ่ม?')) {
      mutation.mutate({
        deleteCodeIndex: index
      });
    }
  };

  const handleStartEdit = (idx, val) => {
    setEditingIdx(idx);
    setEditingVal(val);
  };

  const handleSaveEdit = (index) => {
    if (!editingVal.trim()) return;
    mutation.mutate({
      editCodeIndex: index,
      editCodeValue: editingVal
    });
  };

  if (!isOpen || !gachaItem) return null;

  const unusedCodes = gachaItem.stock || [];
  const wonHistory = gachaItem.usedCodes || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm">
      <div className="absolute inset-0" onClick={onClose} />

      <div className="relative w-full max-w-2xl bg-[#060c13] border border-white/5 p-6 rounded-2xl shadow-2xl glass z-10 grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Left Side: Add Codes Form */}
        <div className="space-y-4">
          <div>
            <h2 className="text-sm font-bold text-white flex items-center gap-1.5">
              <Key className="w-4 h-4 text-sky-400" />
              <span>เติมโค้ดรางวัล Gacha</span>
            </h2>
            <p className="text-[10px] text-zinc-400">{gachaItem.name}</p>
          </div>

          {errorMsg && (
            <div className="bg-red-500/10 border border-red-500/20 px-3 py-2 rounded-xl text-xs text-red-400 flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleAddCodes} className="space-y-3">
            <div className="space-y-1">
              <label className="text-[11px] text-zinc-400 font-semibold block">
                ป้อนรหัสคีย์เพิ่ม (1 รหัสต่อบรรทัด)
              </label>
              <textarea
                value={newCodesInput}
                onChange={(e) => setNewCodesInput(e.target.value)}
                rows="8"
                className="w-full bg-[#03060d] border border-white/5 px-3 py-2 rounded-xl text-xs text-white placeholder-zinc-500 font-mono focus:outline-none focus:border-sky-500 resize-none"
                placeholder={`ตัวอย่าง:\nID: account1 | PASS: 1234\nID: account2 | PASS: 5678`}
              />
            </div>

            <button
              type="submit"
              disabled={mutation.isPending}
              className="w-full flex items-center justify-center gap-1.5 bg-sky-500 text-sky-950 font-bold py-2.5 rounded-xl hover:bg-sky-400 transition-all text-xs glow-btn cursor-pointer"
            >
              {mutation.isPending ? (
                <Loader2 className="w-4.5 h-4.5 animate-spin" />
              ) : (
                <>
                  <Plus className="w-4.5 h-4.5" />
                  <span>บันทึกโค้ดเข้าวงล้อ</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* Right Side: Manage list & Winners History */}
        <div className="flex flex-col h-[400px] border-t md:border-t-0 md:border-l border-white/5 pt-4 md:pt-0 md:pl-6 space-y-4">
          
          {/* Sub Tab buttons */}
          <div className="flex items-center justify-between border-b border-white/5 pb-2">
            <div className="flex gap-2">
              <button
                onClick={() => setActiveSubTab('unused')}
                className={`px-3 py-1 rounded-lg text-[10px] font-bold border transition-colors cursor-pointer ${
                  activeSubTab === 'unused' 
                    ? 'bg-sky-500 text-sky-950 border-sky-500' 
                    : 'bg-zinc-950/40 border-white/5 text-zinc-400 hover:text-white'
                }`}
              >
                คลังพร้อมแจก ({unusedCodes.length})
              </button>
              
              <button
                onClick={() => setActiveSubTab('history')}
                className={`px-3 py-1 rounded-lg text-[10px] font-bold border transition-colors cursor-pointer ${
                  activeSubTab === 'history' 
                    ? 'bg-sky-500 text-sky-950 border-sky-500' 
                    : 'bg-zinc-950/40 border-white/5 text-zinc-400 hover:text-white'
                }`}
              >
                ประวัติคนได้ ({wonHistory.length})
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-1 rounded-lg border border-white/5 text-zinc-400 hover:text-white hover:bg-white/5 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Tab 1: Unused codes view, edit and delete */}
          {activeSubTab === 'unused' && (
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 font-mono text-[10px]">
              {unusedCodes.length === 0 ? (
                <div className="h-full flex items-center justify-center text-zinc-500 font-sans">
                  คลังว่างเปล่า กรุณากรอกสต็อกเพิ่มด้านซ้าย
                </div>
              ) : (
                unusedCodes.map((code, idx) => (
                  <div 
                    key={idx} 
                    className="flex items-center justify-between p-2 rounded-lg border border-white/5 bg-zinc-950/40 text-zinc-300"
                  >
                    {editingIdx === idx ? (
                      <div className="flex-1 flex gap-1 mr-2">
                        <input
                          type="text"
                          value={editingVal}
                          onChange={(e) => setEditingVal(e.target.value)}
                          className="flex-1 bg-[#03060d] border border-sky-500 px-2 py-0.5 rounded text-[10px] text-white focus:outline-none"
                        />
                        <button
                          onClick={() => handleSaveEdit(idx)}
                          className="p-1 bg-sky-500 text-sky-950 rounded cursor-pointer"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setEditingIdx(null)}
                          className="p-1 bg-zinc-800 text-zinc-400 rounded cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <>
                        <span className="truncate pr-2 select-all font-semibold block">{code}</span>
                        
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            onClick={() => handleStartEdit(idx, code)}
                            className="p-1 bg-zinc-900 border border-white/5 rounded text-zinc-400 hover:text-sky-400 cursor-pointer"
                            title="แก้ไขรหัส"
                          >
                            <Edit2 className="w-3 h-3" />
                          </button>
                          
                          <button
                            onClick={() => handleDeleteCode(idx)}
                            className="p-1 bg-zinc-900 border border-white/5 rounded text-zinc-400 hover:text-red-400 cursor-pointer"
                            title="ลบรหัส"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {/* Tab 2: Won codes History */}
          {activeSubTab === 'history' && (
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 font-mono text-[10px]">
              {wonHistory.length === 0 ? (
                <div className="h-full flex items-center justify-center text-zinc-500 font-sans">
                  ยังไม่มีลูกค้าคนไหนสุ่มได้รับรางวัลนี้
                </div>
              ) : (
                wonHistory.map((item, idx) => {
                  const winnerUser = item.wonBy?.username || 'ไม่ระบุผู้ใช้';
                  const dateStr = new Date(item.wonAt).toLocaleDateString('th-TH', { dateStyle: 'short' });
                  
                  return (
                    <div 
                      key={idx} 
                      className="p-2.5 rounded-lg border border-zinc-800 bg-zinc-950/20 text-zinc-400 space-y-1"
                    >
                      <div className="flex justify-between items-center text-[8px] text-zinc-500">
                        <span className="font-semibold text-sky-400">ผู้ชนะ: {winnerUser}</span>
                        <span>{dateStr}</span>
                      </div>
                      <span className="block font-semibold text-zinc-300 break-all select-all">{item.code}</span>
                    </div>
                  );
                })
              )}
            </div>
          )}

        </div>

      </div>
    </div>
  );
}
