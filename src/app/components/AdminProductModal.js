'use client';

import { useState, useEffect } from 'react';
import { X, Save, Loader2, AlertCircle } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';

export default function AdminProductModal({ isOpen, onClose, productToEdit }) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    image: '',
    category: 'Game Card',
    subcategory: 'บัตรเติมเกม',
    stock: '',
    stockType: 'manual',
  });
  const [initialCodes, setInitialCodes] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Sync state if editing a product
  useEffect(() => {
    if (productToEdit) {
      setFormData({
        name: productToEdit.name || '',
        description: productToEdit.description || '',
        price: productToEdit.price || '',
        image: productToEdit.image || '',
        category: productToEdit.category || 'Game Card',
        subcategory: productToEdit.subcategory || 'บัตรเติมเกม',
        stock: productToEdit.stock || '',
        stockType: productToEdit.stockType || 'manual',
      });
      setInitialCodes('');
    } else {
      setFormData({
        name: '',
        description: '',
        price: '',
        image: '',
        category: 'Game Card',
        subcategory: 'บัตรเติมเกม',
        stock: '',
        stockType: 'manual',
      });
      setInitialCodes('');
    }
    setErrorMsg('');
  }, [productToEdit, isOpen]);

  // Adjust subcategory choices based on category selection
  const handleCategoryChange = (e) => {
    const cat = e.target.value;
    let sub = 'บัตรเติมเกม';
    if (cat === 'Steam Wallet') sub = 'Steam Wallet';
    if (cat === 'Streaming') sub = 'Netflix';
    
    setFormData({
      ...formData,
      category: cat,
      subcategory: sub
    });
  };

  const mutation = useMutation({
    mutationFn: async (payload) => {
      const isEdit = !!productToEdit;
      const method = isEdit ? 'PUT' : 'POST';
      const res = await fetch('/api/admin/products', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(isEdit ? { id: productToEdit._id, ...payload } : payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'เกิดข้อผิดพลาดในการบันทึกสินค้า');
      return data;
    },
    onSuccess: () => {
      // Invalidate products query list so UI updates instantly
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
      onClose();
    },
    onError: (err) => {
      setErrorMsg(err.message);
    }
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    setErrorMsg('');

    const { name, description, price, image, category, subcategory, stock, stockType } = formData;
    if (!name || !description || !price || !image || !category || !subcategory || !stockType) {
      setErrorMsg('กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน');
      return;
    }

    mutation.mutate({
      name,
      description,
      price: Number(price),
      image,
      category,
      subcategory,
      stock: stockType === 'code' ? 0 : (Number(stock) || 0),
      stockType,
      initialCodes: stockType === 'code' ? initialCodes : undefined,
    });
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  if (!isOpen) return null;

  const isEdit = !!productToEdit;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="absolute inset-0" onClick={onClose} />

      <div className="relative w-full max-w-lg bg-[#060c13] border border-white/5 p-6 rounded-2xl shadow-2xl glass z-10 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/5 mb-4">
          <h2 className="text-base font-bold text-white">
            {isEdit ? 'แก้ไขข้อมูลสินค้า' : 'เพิ่มสินค้าใหม่'}
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg border border-white/5 text-zinc-400 hover:text-white hover:bg-white/5 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Error Alert */}
        {errorMsg && (
          <div className="bg-red-500/10 border border-red-500/20 px-4 py-3 rounded-xl text-xs text-red-400 flex items-center gap-2 mb-4">
            <AlertCircle className="w-4.5 h-4.5 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
          
          {/* Product Name */}
          <div className="space-y-1">
            <label className="text-xs text-zinc-400 font-semibold block">ชื่อสินค้า *</label>
            <input
              type="text"
              name="name"
              required
              value={formData.name}
              onChange={handleChange}
              className="w-full bg-[#03060d] border border-white/5 px-3 py-2 rounded-xl text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-sky-500"
              placeholder="เช่น Steam Wallet Code 500 THB"
            />
          </div>

          {/* Product Description */}
          <div className="space-y-1">
            <label className="text-xs text-zinc-400 font-semibold block">รายละเอียดสินค้า *</label>
            <textarea
              name="description"
              required
              rows="3"
              value={formData.description}
              onChange={handleChange}
              className="w-full bg-[#03060d] border border-white/5 px-3 py-2 rounded-xl text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-sky-500 resize-none"
              placeholder="รายละเอียดสินค้า ข้อตกลง และการรับประกัน..."
            />
          </div>

          {/* Row layout: Category and Subcategory */}
          <div className="grid grid-cols-2 gap-4">
            
            {/* Category */}
            <div className="space-y-1">
              <label className="text-xs text-zinc-400 font-semibold block">หมวดหมู่หลัก *</label>
              <select
                name="category"
                value={formData.category}
                onChange={handleCategoryChange}
                className="w-full bg-[#03060d] border border-white/5 px-3 py-2 rounded-xl text-sm text-white focus:outline-none focus:border-sky-500"
              >
                <option value="Game Card">Game Card</option>
                <option value="Steam Wallet">Steam Wallet</option>
                <option value="Streaming">Streaming</option>
              </select>
            </div>

            {/* Subcategory */}
            <div className="space-y-1">
              <label className="text-xs text-zinc-400 font-semibold block">หมวดหมู่ย่อย *</label>
              <select
                name="subcategory"
                value={formData.subcategory}
                onChange={handleChange}
                className="w-full bg-[#03060d] border border-white/5 px-3 py-2 rounded-xl text-sm text-white focus:outline-none focus:border-sky-500"
              >
                {formData.category === 'Game Card' && (
                  <option value="บัตรเติมเกม">บัตรเติมเกม</option>
                )}
                {formData.category === 'Steam Wallet' && (
                  <option value="Steam Wallet">Steam Wallet</option>
                )}
                {formData.category === 'Streaming' && (
                  <>
                    <option value="Netflix">Netflix</option>
                    <option value="Disneyplus">Disney+</option>
                    <option value="Spotify">Spotify</option>
                  </>
                )}
              </select>
            </div>

          </div>

          {/* Stock Type Selection */}
          <div className="space-y-1">
            <label className="text-xs text-zinc-400 font-semibold block">ประเภทการสต็อกสินค้า *</label>
            <select
              name="stockType"
              value={formData.stockType}
              onChange={handleChange}
              className="w-full bg-[#03060d] border border-white/5 px-3 py-2 rounded-xl text-sm text-white focus:outline-none focus:border-sky-500"
            >
              <option value="manual">จำนวนสต็อกกำหนดเอง (Manual)</option>
              <option value="code">สต็อกตามรหัสโค้ดจริง (Digital Key Codes)</option>
            </select>
          </div>

          {/* Row layout: Price and Stock */}
          <div className="grid grid-cols-2 gap-4">
            
            {/* Price */}
            <div className="space-y-1">
              <label className="text-xs text-zinc-400 font-semibold block">ราคาสินค้า (THB) *</label>
              <input
                type="number"
                name="price"
                required
                min="0"
                value={formData.price}
                onChange={handleChange}
                className="w-full bg-[#03060d] border border-white/5 px-3 py-2 rounded-xl text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-sky-500"
                placeholder="เช่น 150"
              />
            </div>

            {/* Stock */}
            <div className="space-y-1">
              <label className="text-xs text-zinc-400 font-semibold block">จำนวนสต็อก</label>
              <input
                type="number"
                name="stock"
                disabled={formData.stockType === 'code'}
                min="0"
                value={formData.stockType === 'code' ? '' : formData.stock}
                onChange={handleChange}
                className="w-full bg-[#03060d] border border-white/5 px-3 py-2 rounded-xl text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-sky-500 disabled:opacity-40 disabled:pointer-events-none"
                placeholder={formData.stockType === 'code' ? 'คำนวณตามจริง' : 'เช่น 50'}
              />
            </div>

          </div>

          {/* Initial Codes Textarea (Only visible when stockType is 'code' AND creating new product) */}
          {formData.stockType === 'code' && !isEdit && (
            <div className="space-y-1 animate-in slide-in-from-top-2 duration-200">
              <label className="text-xs text-zinc-400 font-semibold block">
                ป้อนรหัสคีย์เริ่มต้น (1 โค้ดต่อ 1 บรรทัด)
              </label>
              <textarea
                value={initialCodes}
                onChange={(e) => setInitialCodes(e.target.value)}
                rows="4"
                className="w-full bg-[#03060d] border border-white/5 px-3 py-2 rounded-xl text-xs text-white placeholder-zinc-500 font-mono focus:outline-none focus:border-sky-500 resize-none"
                placeholder={`ตัวอย่าง:\nCODE-1111-2222\nCODE-3333-4444`}
              />
            </div>
          )}

          {/* Image URL */}
          <div className="space-y-1">
            <label className="text-xs text-zinc-400 font-semibold block">ลิงก์รูปภาพสินค้า *</label>
            <input
              type="text"
              name="image"
              required
              value={formData.image}
              onChange={handleChange}
              className="w-full bg-[#03060d] border border-white/5 px-3 py-2 rounded-xl text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-sky-500"
              placeholder="https://images.unsplash.com/... หรือ ลิงก์รูปภาพอื่น"
            />
          </div>

          {/* Submit Action */}
          <button
            type="submit"
            disabled={mutation.isPending}
            className="w-full flex items-center justify-center gap-2 bg-sky-500 text-sky-950 font-bold py-3 rounded-xl hover:bg-sky-400 transition-all glow-btn disabled:opacity-50 disabled:pointer-events-none cursor-pointer mt-4"
          >
            {mutation.isPending ? (
              <>
                <Loader2 className="w-4.5 h-4.5 animate-spin" />
                <span>กำลังบันทึกสินค้า...</span>
              </>
            ) : (
              <>
                <Save className="w-4.5 h-4.5" />
                <span>บันทึกสินค้า</span>
              </>
            )}
          </button>

        </form>

      </div>
    </div>
  );
}
