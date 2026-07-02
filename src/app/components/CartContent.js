"use client";
import { useCart } from '@/app/context/CartContext';
import { useSession } from 'next-auth/react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { X, ShoppingBag, Plus, Minus, Trash2, Tag, Loader2, CheckCircle, Copy, Check, Download } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

/**
 * Reusable Cart UI component.
 * Props:
 * - isPage: boolean – true for full page layout, false for drawer.
 * - onClose: function – only used when isPage is false (drawer).
 */
export default function CartContent({ isPage = false, onClose }) {
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
    applyingCoupon,
    removeFromCart,
    updateQuantity,
    clearCart,
    applyCartCoupon,
    removeCartCoupon,
  } = useCart();

  const [couponCodeInput, setCouponCodeInput] = useState('');
  const [checkoutSuccess, setCheckoutSuccess] = useState(null);
  const [checkoutError, setCheckoutError] = useState('');
  const [copiedIdx, setCopiedIdx] = useState(null);

  // ดึงข้อมูลคูปองส่วนตัวสะสมที่พร้อมใช้งาน
  const { data: myCoupons = [] } = useQuery({
    queryKey: ['my-coupons-cart', session?.user?.id],
    queryFn: async () => {
      const res = await fetch('/api/coupons/my-coupons');
      if (!res.ok) throw new Error('Failed to load my coupons');
      return res.json();
    },
    enabled: !!session,
  });

  const activeCoupons = myCoupons.filter(cp => cp.status === 'active');

  const checkoutMutation = useMutation({
    mutationFn: async payload => {
      const res = await fetch('/api/purchase/cart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'ชำระเงินล้มเหลว');
      return data;
    },
    onSuccess: data => {
      setCheckoutSuccess(data);
      clearCart();
      updateSession({ refresh: true });
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
    onError: err => setCheckoutError(err.message),
  });

  const handleCheckout = () => {
    if (!session) return;
    checkoutMutation.mutate({
      items: cartItems.map(i => ({ productId: i._id || i.id, quantity: i.quantity })),
      couponCode: appliedCoupon?.code,
    });
  };

  const handleCopy = (text, idx) => {
    navigator.clipboard.writeText(text);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  const finalPrice = Math.max(0, priceAfterVip - (appliedCoupon ? appliedCoupon.discount : 0));
  const insufficientBalance = session && session.user.balance < finalPrice;

  // Layout wrappers – drawer adds backdrop and fixed container, page uses simple div
  const Wrapper = ({ children }) =>
    isPage ? (
      <div className="max-w-4xl mx-auto p-4 space-y-6 font-sans">
        {children}
      </div>
    ) : (
      <div className="fixed inset-0 z-50 flex justify-end overflow-hidden font-sans">
        {/* Backdrop */}
        <div className="absolute inset-0 bg-black/75 backdrop-blur-xs" onClick={onClose} />
        {/* Drawer Panel */}
        <div className="relative w-full max-w-md bg-[#060c13]/90 backdrop-blur-xl border-l border-white/10 flex flex-col h-full shadow-[0_0_50px_rgba(14,165,233,0.15)] z-10 transition-transform duration-300">
          {children}
        </div>
      </div>
    );

  return (
    <Wrapper>
      {/* Header */}
      <div className="p-5 border-b border-white/5 flex items-center justify-between relative z-10">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-sky-500/10 text-sky-400 border border-sky-500/20">
            <ShoppingBag className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white tracking-tight">ตะกร้าสินค้าของคุณ</h2>
            <p className="text-[10px] text-zinc-400 font-medium">มีสินค้าทั้งหมด {cartCount} รายการในตะกร้า</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {cartItems.length > 0 && (
            <button
              onClick={clearCart}
              className="text-[10px] font-bold text-red-400 hover:text-red-300 px-2.5 py-1.5 border border-red-500/10 hover:border-red-500/30 rounded-xl transition-all hover:bg-red-500/5 cursor-pointer animate-pulse"
            >
              ล้างตะกร้า
            </button>
          )}
          <button onClick={onClose} className="p-2 rounded-xl border border-white/5 text-zinc-400 hover:text-white hover:bg-white/5 hover:border-white/10 cursor-pointer transition-colors">
            <X className="w-4.5 h-4.5" />
          </button>
        </div>
      </div>

      {/* Main Content */}
      {checkoutSuccess ? (
        <div className="flex-1 overflow-y-auto p-6 flex flex-col justify-center text-center space-y-6 relative z-10">
          <div className="inline-flex bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-2xl text-emerald-400 mx-auto animate-bounce shadow-[0_0_30px_rgba(16,185,129,0.2)]">
            <CheckCircle className="w-12 h-12" />
          </div>
          <div className="space-y-1">
            <h2 className="text-lg font-bold text-white glow-text">ชำระเงินสำเร็จแล้ว!</h2>
            <p className="text-xs text-zinc-400">ขอบคุณสำหรับการสั่งซื้อ ระบบได้จัดเตรียมรหัสให้คุณเรียบร้อยแล้ว</p>
          </div>
          <div className="text-left space-y-3 max-h-[300px] overflow-y-auto pr-1">
            {checkoutSuccess.purchasedItems?.map((item, idx) => (
              <div key={idx} className="bg-zinc-950/60 border border-white/5 rounded-2xl p-4 space-y-2">
                <span className="text-[10px] bg-sky-500/10 text-sky-400 px-2 py-0.5 rounded font-bold border border-sky-500/10">{item.productName}</span>
                <div className="space-y-1.5 pt-1.5">
                  {item.receivedCodes?.map((code, cIdx) => {
                    const uniqueIdx = `${idx}-${cIdx}`;
                    return (
                      <div key={cIdx} className="flex items-center justify-between gap-2 bg-[#02060d] border border-white/5 px-2.5 py-2 rounded-xl text-xs font-mono text-zinc-200 hover:border-white/10 transition-colors">
                        <span className="truncate select-all">{code}</span>
                        <button onClick={() => handleCopy(code, uniqueIdx)} className="text-zinc-500 hover:text-sky-400 cursor-pointer shrink-0 active:scale-90 transition-transform" title="คัดลอกรหัส">
                          {copiedIdx === uniqueIdx ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          <div className="space-y-2 pt-2">
            <button onClick={() => (window.location.href = '/products')} className="w-full flex items-center justify-center gap-1.5 py-3 bg-sky-500 text-sky-950 hover:bg-sky-400 rounded-xl text-xs font-bold transition-all cursor-pointer glow-btn">
              <Download className="w-4 h-4" />
              <span>ดูสินค้าเพิ่มเติม</span>
            </button>
            <button onClick={onClose} className="w-full py-3 bg-zinc-900 border border-white/5 hover:border-white/10 text-zinc-300 hover:text-white rounded-xl text-xs font-bold transition-all cursor-pointer">
              ปิดหน้าตระกร้า
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Items List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 relative z-10 scrollbar-thin">
            {cartItems.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center space-y-3 text-zinc-500 py-20">
                <ShoppingBag className="w-12 h-12 stroke-[1.2] text-zinc-700" />
                <div>
                  <p className="text-xs font-bold text-zinc-400">ยังไม่มีสินค้าในตะกร้า</p>
                  <p className="text-[10px] text-zinc-500 max-w-[200px] mx-auto mt-1">เลือกซื้อสินค้าจากหน้าร้านหลักเพื่อหยิบใส่ตะกร้าและทำการชำระเงิน</p>
                </div>
                <button onClick={onClose} className="bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 font-bold px-5 py-2.5 rounded-xl text-[11px] border border-sky-500/15 transition-all active:scale-95 cursor-pointer">
                  เริ่มช็อปปิ้งสินค้า
                </button>
              </div>
            ) : (
              cartItems.map(item => {
                const itemId = item._id || item.id;
                const isMaxStock = item.quantity >= item.stock;
                return (
                  <div key={itemId} className="bg-zinc-950/40 border border-white/5 rounded-2xl p-3 flex gap-3 items-center hover:border-white/10 transition-colors">
                    <img src={item.image || 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=100'} alt={item.name} className="w-12 h-12 rounded-xl object-cover border border-white/5 shrink-0 bg-zinc-900" />
                    <div className="flex-1 min-w-0 space-y-0.5">
                      <span className="text-[8px] bg-sky-500/10 text-sky-400 px-1 py-0.5 rounded font-bold border border-sky-500/10 uppercase">{item.subcategory}</span>
                      <h4 className="text-xs font-bold text-white truncate">{item.name}</h4>
                      <div className="flex items-center gap-1.5 text-[10px] text-zinc-400">
                        <span className="font-semibold text-sky-400">{item.price} THB</span>
                        <span>•</span>
                        <span className={`${isMaxStock ? 'text-amber-400 font-bold animate-pulse' : 'text-zinc-500'}`}>
                          {isMaxStock ? 'ชนยอดสต็อก' : `คงเหลือ: ${item.stock} ชิ้น`}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 bg-zinc-900 border border-white/5 p-1 rounded-xl shrink-0">
                      <button onClick={() => updateQuantity(itemId, item.quantity - 1)} disabled={item.quantity <= 1} className="p-1 rounded-md text-zinc-500 hover:text-white disabled:opacity-30 cursor-pointer transition-colors">
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="text-xs font-bold text-white w-4 text-center">{item.quantity}</span>
                      <button onClick={() => updateQuantity(itemId, item.quantity + 1)} disabled={isMaxStock} className={`p-1 rounded-md ${isMaxStock ? 'bg-amber-500/10 text-amber-400 border border-amber-500/10 cursor-not-allowed opacity-80' : 'text-zinc-500 hover:text-white cursor-pointer'} transition-colors`} title={isMaxStock ? 'สินค้าในคลังมีไม่เพียงพอสำหรับการเพิ่มจำนวน' : 'เพิ่มจำนวน'}>
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => removeFromCart(itemId)} className="p-2 text-zinc-500 hover:text-red-400 transition-colors cursor-pointer" title="ลบออกจากตะกร้า">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
          {/* Footer (coupon, total, checkout) */}
          <div className="border-t border-white/5 p-5 bg-zinc-950/60 relative z-10 space-y-4">
            {/* Coupon */}
            {session && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-[11px] font-semibold text-zinc-400">
                  <span className="flex items-center gap-1"><Tag className="w-3 h-3 text-sky-400" /> คูปองส่วนลดตะกร้า</span>
                  {appliedCoupon && <span className="text-emerald-400">ส่วนลดแล้ว: -{appliedCoupon.discount} บาท</span>}
                </div>
                {appliedCoupon ? (
                  <div className="flex items-center justify-between bg-emerald-500/10 border border-emerald-500/20 px-3 py-2 rounded-xl text-xs text-emerald-400">
                    <span className="font-mono font-bold tracking-wider">{appliedCoupon.code}</span>
                    <button type="button" onClick={removeCartCoupon} className="text-red-400 hover:text-red-300 font-semibold cursor-pointer active:scale-95 transition-transform">ยกเลิก</button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <input type="text" value={couponCodeInput} onChange={e => setCouponCodeInput(e.target.value)} className="flex-1 bg-zinc-900 border border-white/5 rounded px-2 py-1 text-sm text-zinc-300 placeholder-zinc-600" placeholder="ใส่รหัสคูปอง" />
                    <button onClick={() => applyCartCoupon(couponCodeInput)} disabled={applyingCoupon} className="px-3 py-1 bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 rounded disabled:opacity-50">
                      {applyingCoupon ? <Loader2 className="w-4 h-4 animate-spin" /> : 'ใช้คูปอง'}
                    </button>
                  </div>
                )}
                {couponError && <p className="text-xs text-red-400 mt-1">{couponError}</p>}
                {!appliedCoupon && activeCoupons.length > 0 && (
                  <div className="space-y-1.5 pt-1">
                    <span className="text-[9px] text-zinc-500 font-semibold block">คูปองสะสมของคุณ (คลิกเพื่อใช้งาน):</span>
                    <div className="flex flex-wrap gap-1.5 max-h-20 overflow-y-auto pr-1">
                      {activeCoupons.map((cp) => (
                        <button
                          key={cp.id}
                          type="button"
                          onClick={() => {
                            setCouponCodeInput(cp.code);
                            applyCartCoupon(cp.code);
                          }}
                          className="text-[9px] font-black text-sky-400 hover:text-sky-300 bg-sky-950/20 border border-sky-500/10 px-2 py-1 rounded-xl transition-all cursor-pointer hover:border-sky-500/30"
                        >
                          {cp.code} ({cp.type === 'percentage' ? `${cp.discount}%` : `${cp.discount}฿`})
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
            {/* Summary */}
            <div className="flex justify-between items-center text-sm text-white">
              <span>รวมสินค้า: {cartTotal.toLocaleString()} THB</span>
              {vipDiscountPercent > 0 && <span>ส่วนลด VIP ({vipDiscountPercent}%): -{vipDiscountAmount.toLocaleString()} THB</span>}
            </div>
            <div className="flex justify-between items-center text-lg font-bold text-white">
              <span>ยอดรวมทั้งหมด</span>
              <span>{finalPrice.toLocaleString()} THB</span>
            </div>
            {checkoutError && <p className="text-red-400 text-sm">{checkoutError}</p>}
            <button onClick={handleCheckout} disabled={insufficientBalance || checkoutMutation.isLoading} className={`w-full py-2 rounded-xl text-white font-bold transition-all ${insufficientBalance ? 'bg-gray-600 cursor-not-allowed' : 'bg-sky-500 hover:bg-sky-400'} ${checkoutMutation.isLoading ? 'opacity-70' : ''}`}>เช็คเอาท์</button>
          </div>
        </>
      )}
    </Wrapper>
  );
}
