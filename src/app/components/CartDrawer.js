'use client';

import { useState } from 'react';
import { useCart } from '../context/CartContext';
import { useSession } from 'next-auth/react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  X, ShoppingBag, Plus, Minus, Trash2, Tag, 
  Loader2, Wallet, AlertCircle, CheckCircle, Copy, Check, Download, Info 
} from 'lucide-react';
import Link from 'next/link';

export default function CartDrawer({ isOpen, onClose }) {
  const { data: session, update: updateSession } = useSession();
  const queryClient = useQueryClient();

  const {
    cartItems,
    cartCount,
    cartTotal,
    vipDiscountPercent,
    vipDiscountAmount,
    priceAfterVip,
    appliedCoupon,
    couponError,
    validatingCoupon,
    removeFromCart,
    updateQuantity,
    clearCart,
    applyCartCoupon,
    removeCartCoupon,
  } = useCart();

  const [couponCodeInput, setCouponCodeInput] = useState('');
  const [checkoutSuccess, setCheckoutSuccess] = useState(null); // stores success order details
  const [copiedIdx, setCopiedIdx] = useState(null);
  const [checkoutError, setCheckoutError] = useState('');

  // 1. Checkout Mutation
  const checkoutMutation = useMutation({
    mutationFn: async (payload) => {
      const res = await fetch('/api/purchase/cart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'ชำระเงินล้มเหลว');
      return data;
    },
    onSuccess: (data) => {
      setCheckoutSuccess(data);
      // Clear local storage and cart state
      clearCart();
      // Refresh user session (balance / spent)
      updateSession({ refresh: true });
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
    },
    onError: (err) => {
      setCheckoutError(err.message);
    }
  });

  const handleCheckout = () => {
    if (!session) return;
    setCheckoutError('');
    checkoutMutation.mutate({
      items: cartItems.map(item => ({ productId: item._id || item.id, quantity: item.quantity })),
      couponCode: appliedCoupon ? appliedCoupon.code : undefined
    });
  };

  const handleCopy = (text, idx) => {
    navigator.clipboard.writeText(text);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  const handleDownloadTxt = () => {
    if (!checkoutSuccess || !checkoutSuccess.purchasedItems) return;
    
    let textContent = `NakataShop - รายละเอียดคีย์สินค้าที่ได้รับ\n`;
    textContent += `วันที่สั่งซื้อ: ${new Date().toLocaleString('th-TH')}\n`;
    textContent += `ผู้ซื้อ: ${session?.user?.username || 'ลูกค้าทั่วไป'}\n`;
    textContent += `=========================================\n\n`;
    
    checkoutSuccess.purchasedItems.forEach((item, index) => {
      textContent += `${index + 1}. สินค้า: ${item.productName}\n`;
      textContent += `รหัสโค้ดที่ได้รับ:\n`;
      item.receivedCodes?.forEach((code, cIdx) => {
        textContent += `   - ${code}\n`;
      });
      textContent += `-----------------------------------------\n\n`;
    });
    
    textContent += `ขอบคุณที่สั่งซื้อสินค้ากับ NakataShop หวังว่าจะได้รับการสนับสนุนในโอกาสถัดไป!`;

    const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `NakataShop-Codes-${Date.now()}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleClose = () => {
    setCheckoutSuccess(null);
    setCheckoutError('');
    onClose();
  };

  const handleClearAll = () => {
    if (window.confirm('คุณแน่ใจหรือไม่ว่าต้องการลบสินค้าทั้งหมดออกจากตะกร้า?')) {
      clearCart();
    }
  };

  if (!isOpen) return null;

  const finalPrice = Math.max(0, priceAfterVip - (appliedCoupon ? appliedCoupon.discount : 0));
  const insufficientBalance = session && session.user.balance < finalPrice;

  return (
    <div className="fixed inset-0 z-50 flex justify-end overflow-hidden font-sans">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/75 backdrop-blur-xs transition-opacity duration-300"
        onClick={handleClose}
      />

      {/* Drawer Panel (Styled with premium Glassmorphism & Neon Glow) */}
      <div className="relative w-full max-w-md bg-[#060c13]/90 backdrop-blur-xl border-l border-white/10 flex flex-col h-full shadow-[0_0_50px_rgba(14,165,233,0.15)] z-10 transition-transform duration-300">
        
        {/* Glow ambient background elements */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-sky-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />

        {/* Header */}
        <div className="p-5 border-b border-white/5 flex items-center justify-between relative z-10">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-sky-500/10 text-sky-400 border border-sky-500/20">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white tracking-tight">ตะกร้าสินค้าของคุณ</h2>
              <p className="text-[10px] text-zinc-400 font-medium">มีสินค้าทั้้งหมด {cartCount} รายการในตะกร้า</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {cartItems.length > 0 && (
              <button
                onClick={handleClearAll}
                className="text-[10px] font-bold text-red-400 hover:text-red-300 px-2.5 py-1.5 border border-red-500/10 hover:border-red-500/30 rounded-xl transition-all hover:bg-red-500/5 cursor-pointer animate-pulse"
              >
                ล้างตะกร้า
              </button>
            )}
            <button 
              onClick={handleClose}
              className="p-2 rounded-xl border border-white/5 text-zinc-400 hover:text-white hover:bg-white/5 hover:border-white/10 cursor-pointer transition-colors"
            >
              <X className="w-4.5 h-4.5" />
            </button>
          </div>
        </div>

        {/* Success Checkout Screen */}
        {checkoutSuccess ? (
          <div className="flex-1 overflow-y-auto p-6 flex flex-col justify-center text-center space-y-6 relative z-10">
            <div className="inline-flex bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-2xl text-emerald-400 mx-auto animate-bounce shadow-[0_0_30px_rgba(16,185,129,0.2)]">
              <CheckCircle className="w-12 h-12" />
            </div>

            <div className="space-y-1">
              <h2 className="text-lg font-bold text-white glow-text">ชำระเงินสำเร็จแล้ว!</h2>
              <p className="text-xs text-zinc-400">ขอบคุณสำหรับการสั่งซื้อ ระบบได้จัดเตรียมรหัสให้คุณเรียบร้อยแล้ว</p>
            </div>

            {/* Received codes container */}
            <div className="text-left space-y-3 max-h-[300px] overflow-y-auto pr-1">
              {checkoutSuccess.purchasedItems?.map((item, idx) => (
                <div key={idx} className="bg-zinc-950/60 border border-white/5 rounded-2xl p-4 space-y-2">
                  <span className="text-[10px] bg-sky-500/10 text-sky-400 px-2 py-0.5 rounded font-bold border border-sky-500/10">
                    {item.productName}
                  </span>
                  <div className="space-y-1.5 pt-1.5">
                    {item.receivedCodes?.map((code, cIdx) => {
                      const uniqueIdx = `${idx}-${cIdx}`;
                      return (
                        <div key={cIdx} className="flex items-center justify-between gap-2 bg-[#02060d] border border-white/5 px-2.5 py-2 rounded-xl text-xs font-mono text-zinc-200 hover:border-white/10 transition-colors">
                          <span className="truncate select-all">{code}</span>
                          <button
                            onClick={() => handleCopy(code, uniqueIdx)}
                            className="text-zinc-500 hover:text-sky-400 cursor-pointer shrink-0 active:scale-90 transition-transform"
                            title="คัดลอกรหัส"
                          >
                            {copiedIdx === uniqueIdx ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* Action buttons */}
            <div className="space-y-2 pt-2">
              <button
                onClick={handleDownloadTxt}
                className="w-full flex items-center justify-center gap-1.5 py-3 bg-sky-500 text-sky-950 hover:bg-sky-400 rounded-xl text-xs font-bold transition-all cursor-pointer glow-btn"
              >
                <Download className="w-4 h-4" />
                <span>ดาวน์โหลดรหัสทั้งหมดเป็นไฟล์ TXT</span>
              </button>
              <button
                onClick={handleClose}
                className="w-full py-3 bg-zinc-900 border border-white/5 hover:border-white/10 text-zinc-300 hover:text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                ปิดหน้าต่างตะกร้า
              </button>
            </div>
          </div>
        ) : (
          /* CART CONTENT SCREEN */
          <>
            {/* Items List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 relative z-10 scrollbar-thin">
              {cartItems.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center space-y-3 text-zinc-500 py-20">
                  <ShoppingBag className="w-12 h-12 stroke-[1.2] text-zinc-700" />
                  <div>
                    <p className="text-xs font-bold text-zinc-400">ยังไม่มีสินค้าในตะกร้า</p>
                    <p className="text-[10px] text-zinc-500 max-w-[200px] mx-auto mt-1">เลือกซื้อสินค้าที่หน้าร้านหลักเพื่อหยิบใส่ตะกร้าและทำการชำระเงิน</p>
                  </div>
                  <button
                    onClick={handleClose}
                    className="bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 font-bold px-5 py-2.5 rounded-xl text-[11px] border border-sky-500/15 transition-all active:scale-95 cursor-pointer"
                  >
                    เริ่มช็อปปิ้งสินค้า
                  </button>
                </div>
              ) : (
                cartItems.map((item) => {
                  const itemId = item._id || item.id;
                  const isMaxStock = item.quantity >= item.stock;
                  return (
                    <div 
                      key={itemId} 
                      className="bg-zinc-950/40 border border-white/5 rounded-2xl p-3 flex gap-3 items-center hover:border-white/10 transition-colors"
                    >
                      {/* Item Thumbnail */}
                      <img 
                        src={item.image || 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=100'} 
                        alt={item.name}
                        className="w-12 h-12 rounded-xl object-cover border border-white/5 shrink-0 bg-zinc-900"
                      />

                      {/* Item Text details */}
                      <div className="flex-1 min-w-0 space-y-0.5">
                        <span className="text-[8px] bg-sky-500/10 text-sky-400 px-1 py-0.5 rounded font-bold border border-sky-500/10 uppercase">
                          {item.subcategory}
                        </span>
                        <h4 className="text-xs font-bold text-white truncate">{item.name}</h4>
                        <div className="flex items-center gap-1.5 text-[10px] text-zinc-400">
                          <span className="font-semibold text-sky-400">{item.price} THB</span>
                          <span>•</span>
                          <span className={`${isMaxStock ? 'text-amber-400 font-bold animate-pulse' : 'text-zinc-500'}`}>
                            {isMaxStock ? 'ชนยอดสต็อก' : `คงเหลือ: ${item.stock} ชิ้น`}
                          </span>
                        </div>
                      </div>

                      {/* Quantity controls */}
                      <div className="flex items-center gap-1.5 bg-zinc-900 border border-white/5 p-1 rounded-xl shrink-0">
                        <button
                          onClick={() => updateQuantity(itemId, item.quantity - 1)}
                          disabled={item.quantity <= 1}
                          className="p-1 rounded-md text-zinc-500 hover:text-white disabled:opacity-30 cursor-pointer transition-colors"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="text-xs font-bold text-white w-4 text-center">{item.quantity}</span>
                        <button
                          onClick={() => updateQuantity(itemId, item.quantity + 1)}
                          disabled={isMaxStock}
                          className={`p-1 rounded-md transition-colors ${
                            isMaxStock 
                              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/10 cursor-not-allowed opacity-80' 
                              : 'text-zinc-500 hover:text-white cursor-pointer'
                          }`}
                          title={isMaxStock ? 'สินค้าในคลังมีไม่เพียงพอสำหรับการเพิ่มจำนวน' : 'เพิ่มจำนวน'}
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Delete button */}
                      <button
                        onClick={() => removeFromCart(itemId)}
                        className="p-2 text-zinc-500 hover:text-red-400 transition-colors cursor-pointer active:scale-90"
                        title="ลบออกจากตะกร้า"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer Summary & Checkout */}
            {cartItems.length > 0 && (
              <div className="border-t border-white/5 p-5 bg-zinc-950/60 relative z-10 space-y-4 shadow-[0_-5px_30px_rgba(0,0,0,0.4)]">
                {/* Coupon form */}
                {session && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-[11px] font-semibold text-zinc-400">
                      <span className="flex items-center gap-1">
                        <Tag className="w-3 h-3 text-sky-400" />
                        คูปองส่วนลดตะกร้า
                      </span>
                      {appliedCoupon && (
                        <span className="text-emerald-400">ส่วนลดแล้ว: -{appliedCoupon.discount} บาท</span>
                      )}
                    </div>

                    {appliedCoupon ? (
                      <div className="flex items-center justify-between bg-emerald-500/10 border border-emerald-500/20 px-3 py-2 rounded-xl text-xs text-emerald-400">
                        <span className="font-mono font-bold tracking-wider">{appliedCoupon.code}</span>
                        <button
                          type="button"
                          onClick={removeCartCoupon}
                          className="text-red-400 hover:text-red-300 font-semibold cursor-pointer active:scale-95 transition-transform"
                        >
                          ยกเลิก
                        </button>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={couponCodeInput}
                          onChange={(e) => setCouponCodeInput(e.target.value)}
                          placeholder="ป้อนโค้ดส่วนลด เช่น NAKATA10"
                          className="flex-1 bg-[#03060d] border border-white/5 px-3 py-1.5 rounded-xl text-xs text-white placeholder-zinc-600 uppercase focus:outline-none focus:border-sky-500/30"
                        />
                        <button
                          type="button"
                          disabled={validatingCoupon || !couponCodeInput}
                          onClick={async () => {
                            const success = await applyCartCoupon(couponCodeInput);
                            if (success) setCouponCodeInput('');
                          }}
                          className="bg-sky-500 text-sky-950 text-xs font-bold px-3 py-1.5 rounded-xl hover:bg-sky-400 transition-colors disabled:opacity-50 cursor-pointer active:scale-95"
                        >
                          {validatingCoupon ? <Loader2 className="w-4.5 h-4.5 animate-spin" /> : 'ใช้งาน'}
                        </button>
                      </div>
                    )}
                    {couponError && (
                      <span className="text-[10px] text-red-400 block font-sans">{couponError}</span>
                    )}
                  </div>
                )}

                {/* Price Breakdown */}
                <div className="space-y-1.5 text-xs text-zinc-400 font-sans border-b border-white/5 pb-3">
                  <div className="flex justify-between">
                    <span>ราคารวมสินค้า:</span>
                    <span className="text-zinc-200">{cartTotal.toLocaleString()} THB</span>
                  </div>
                  {vipDiscountPercent > 0 && (
                    <div className="flex justify-between text-sky-400">
                      <span>ส่วนลด VIP Rank ({vipDiscountPercent}%):</span>
                      <span>-{vipDiscountAmount} THB</span>
                    </div>
                  )}
                  {appliedCoupon && (
                    <div className="flex justify-between text-emerald-400">
                      <span>คูปองส่วนลด ({appliedCoupon.code}):</span>
                      <span>-{appliedCoupon.discount} THB</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm font-bold text-white pt-1">
                    <span>ยอดชำระเงินสุทธิ:</span>
                    <span className="text-sky-400 text-sm">{finalPrice.toLocaleString()} THB</span>
                  </div>
                </div>

                {/* Checkout errors */}
                {checkoutError && (
                  <div className="bg-red-500/10 border border-red-500/20 px-3 py-2 rounded-xl text-xs text-red-400 flex items-center gap-1.5 font-sans">
                    <AlertCircle className="w-4.5 h-4.5 shrink-0" />
                    <span>{checkoutError}</span>
                  </div>
                )}

                {/* Checkout action button */}
                {session ? (
                  insufficientBalance ? (
                    <div className="space-y-2 font-sans">
                      <div className="flex items-center gap-1.5 text-[11px] text-amber-400">
                        <Info className="w-4 h-4 text-amber-400" />
                        <span>ยอดเงินคงเหลือไม่เพียงพอ (ขาดอีก {(finalPrice - session.user.balance).toLocaleString()} บาท)</span>
                      </div>
                      <Link
                        href="/topup"
                        onClick={handleClose}
                        className="w-full flex items-center justify-center gap-1.5 bg-amber-500 text-amber-950 font-bold py-3 rounded-xl text-xs transition-colors hover:bg-amber-400 cursor-pointer glow-btn"
                      >
                        <Wallet className="w-4 h-4" />
                        <span>เติมเงินในกระเป๋า</span>
                      </Link>
                    </div>
                  ) : (
                    <button
                      onClick={handleCheckout}
                      disabled={checkoutMutation.isPending}
                      className="w-full flex items-center justify-center gap-1.5 bg-sky-500 text-sky-950 font-bold py-3 rounded-xl hover:bg-sky-400 transition-all text-xs glow-btn disabled:opacity-50 cursor-pointer"
                    >
                      {checkoutMutation.isPending ? (
                        <Loader2 className="w-4.5 h-4.5 animate-spin" />
                      ) : (
                        <span>ชำระเงินทันที ({finalPrice.toLocaleString()} THB)</span>
                      )}
                    </button>
                  )
                ) : (
                  <Link
                    href="/auth/signin"
                    onClick={handleClose}
                    className="w-full flex items-center justify-center bg-zinc-900 border border-white/5 hover:border-white/10 text-zinc-300 hover:text-white font-bold py-3 rounded-xl text-xs transition-all cursor-pointer"
                  >
                    เข้าสู่ระบบเพื่อดำเนินการสั่งซื้อ
                  </Link>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
