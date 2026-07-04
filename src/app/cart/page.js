'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ShoppingCart, ShoppingBag, Plus, Minus, Trash2, Tag,
  Loader2, Wallet, AlertCircle, CheckCircle, Copy, Check,
  Download, Info, LogIn, ArrowRight, Sparkles, Package
} from 'lucide-react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import CanvasBackground from '../components/CanvasBackground';
import ProductDetailModal from '../components/ProductDetailModal';
import { useCart } from '../context/CartContext';
import Link from 'next/link';

export default function CartPage() {
  const { data: session, status, update: updateSession } = useSession();
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
  const [checkoutSuccess, setCheckoutSuccess] = useState(null);
  const [checkoutError, setCheckoutError] = useState('');
  const [copiedIdx, setCopiedIdx] = useState(null);
  const [selectedProduct, setSelectedProduct] = useState(null);

  // Fetch recommended products
  const { data: recommendedProducts = [] } = useQuery({
    queryKey: ['recommended-products'],
    queryFn: async () => {
      const res = await fetch('/api/products');
      if (!res.ok) throw new Error('ไม่สามารถโหลดสินค้าแนะนำได้');
      const all = await res.json();
      // สุ่มเลือก 4 รายการ ที่มี stock > 0
      const available = all.filter(p => p.stock > 0);
      const shuffled = available.sort(() => 0.5 - Math.random());
      return shuffled.slice(0, 4);
    },
    enabled: !!session,
  });

  // Checkout mutation
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
      clearCart();
      updateSession({ refresh: true });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['recommended-products'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
    },
    onError: (err) => {
      setCheckoutError(err.message);
    },
  });

  const handleCheckout = () => {
    if (!session) return;
    setCheckoutError('');
    checkoutMutation.mutate({
      items: cartItems.map(item => ({ productId: item._id || item.id, quantity: item.quantity })),
      couponCode: appliedCoupon ? appliedCoupon.code : undefined,
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
      item.receivedCodes?.forEach((code) => {
        textContent += `   - ${code}\n`;
      });
      textContent += `-----------------------------------------\n\n`;
    });
    textContent += `ขอบคุณที่สั่งซื้อสินค้ากับ NakataShop!`;
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

  const handleClearAll = () => {
    if (window.confirm('คุณแน่ใจหรือไม่ว่าต้องการลบสินค้าทั้งหมดออกจากตะกร้า?')) {
      clearCart();
    }
  };

  const finalPrice = Math.max(0, priceAfterVip - (appliedCoupon ? appliedCoupon.discount : 0));
  const insufficientBalance = session && session.user.balance < finalPrice;

  return (
    <div className="relative min-h-screen bg-[#02060d] text-white flex flex-col font-sans">
      <CanvasBackground />
      <Navbar />

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-8 relative z-10 space-y-8">

        {/* Page Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-black bg-gradient-to-r from-sky-400 via-blue-500 to-purple-500 bg-clip-text text-transparent leading-normal">
              ตะกร้าสินค้าของคุณ
            </h1>
            <p className="text-sm text-zinc-400">
              ตรวจสอบรายการสินค้า เพิ่มลดจำนวน และชำระเงินได้ง่าย ๆ ในที่เดียว
            </p>
          </div>
          {session && cartItems.length > 0 && !checkoutSuccess && (
            <button
              onClick={handleClearAll}
              className="flex items-center gap-2 text-xs font-semibold text-red-400 bg-red-950/20 border border-red-500/10 hover:border-red-500/30 px-4 py-2 rounded-xl transition-all cursor-pointer hover:bg-red-950/40"
            >
              <Trash2 className="w-3.5 h-3.5" />
              ล้างตะกร้าทั้งหมด
            </button>
          )}
        </div>

        {/* Loading state */}
        {status === 'loading' ? (
          <div className="flex flex-col items-center justify-center py-32 gap-3 bg-zinc-950/20 border border-white/5 rounded-2xl backdrop-blur-md">
            <div className="w-10 h-10 border-4 border-sky-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-zinc-400">กำลังยืนยันตัวตน...</p>
          </div>
        ) : !session ? (
          /* Sign In Reminder Card - same style as inventory page */
          <div className="flex flex-col items-center justify-center py-20 px-6 text-center max-w-md mx-auto bg-zinc-950/45 border border-white/5 rounded-3xl backdrop-blur-md space-y-6">
            <div className="bg-red-500/10 p-4 rounded-full text-red-400">
              <AlertCircle className="w-12 h-12" />
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-bold">กรุณาเข้าสู่ระบบ</h2>
              <p className="text-sm text-zinc-400 leading-relaxed">
                คุณจำเป็นต้องเข้าสู่ระบบสมาชิกเพื่อเข้าถึงตะกร้าสินค้าและทำการชำระเงิน
              </p>
            </div>
            <Link
              href="/auth/signin"
              className="w-full flex items-center justify-center gap-2 text-sm font-bold bg-sky-500 text-sky-950 hover:bg-sky-400 py-3 rounded-xl transition-all glow-btn"
            >
              <LogIn className="w-4 h-4" />
              เข้าสู่ระบบตอนนี้
            </Link>
          </div>
        ) : checkoutSuccess ? (
          /* ─── Checkout Success Screen ─── */
          <div className="max-w-2xl mx-auto space-y-6">
            <div className="bg-zinc-950/40 border border-white/5 rounded-3xl p-8 backdrop-blur-md space-y-6 text-center relative overflow-hidden">
              <div className="absolute top-0 right-0 w-48 h-48 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />
              <div className="absolute bottom-0 left-0 w-48 h-48 bg-sky-500/5 rounded-full blur-3xl pointer-events-none" />

              <div className="inline-flex bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-2xl text-emerald-400 mx-auto animate-bounce shadow-[0_0_30px_rgba(16,185,129,0.2)]">
                <CheckCircle className="w-12 h-12" />
              </div>

              <div className="space-y-1">
                <h2 className="text-2xl font-black text-white glow-text">ชำระเงินสำเร็จแล้ว!</h2>
                <p className="text-sm text-zinc-400">ขอบคุณสำหรับการสั่งซื้อ ระบบได้จัดเตรียมรหัสให้คุณเรียบร้อยแล้ว</p>
              </div>

              {/* Received codes */}
              <div className="text-left space-y-3 max-h-[400px] overflow-y-auto pr-1">
                {checkoutSuccess.purchasedItems?.map((item, idx) => (
                  <div key={idx} className="bg-zinc-900/60 border border-white/5 rounded-2xl p-4 space-y-2">
                    <span className="text-[10px] bg-sky-500/10 text-sky-400 px-2 py-0.5 rounded font-bold border border-sky-500/10">
                      {item.productName}
                    </span>
                    <div className="space-y-1.5 pt-1.5">
                      {item.receivedCodes?.map((code, cIdx) => {
                        const uniqueIdx = `${idx}-${cIdx}`;
                        return (
                          <div key={cIdx} className="flex items-center justify-between gap-2 bg-[#02060d] border border-white/5 px-3 py-2.5 rounded-xl text-xs font-mono text-zinc-200 hover:border-white/10 transition-colors">
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
              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <button
                  onClick={handleDownloadTxt}
                  className="flex-1 flex items-center justify-center gap-1.5 py-3 bg-sky-500 text-sky-950 hover:bg-sky-400 rounded-xl text-xs font-bold transition-all cursor-pointer glow-btn"
                >
                  <Download className="w-4 h-4" />
                  ดาวน์โหลดรหัสทั้งหมดเป็น TXT
                </button>
                <Link
                  href="/products"
                  className="flex-1 flex items-center justify-center gap-1.5 py-3 bg-zinc-900 border border-white/5 hover:border-white/10 text-zinc-300 hover:text-white rounded-xl text-xs font-bold transition-all"
                >
                  <ShoppingBag className="w-4 h-4" />
                  เลือกซื้อสินค้าต่อ
                </Link>
              </div>
            </div>
          </div>
        ) : (
          /* ─── Main Cart Content ─── */
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

            {/* Left Column: Cart Items */}
            <div className="lg:col-span-2 space-y-4">

              {/* Cart Items Header Badge */}
              <div className="bg-zinc-950/45 border border-white/5 rounded-3xl p-5 backdrop-blur-md flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="bg-sky-500/10 p-2.5 rounded-xl text-sky-400 border border-sky-500/20">
                    <ShoppingCart className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-white">รายการสินค้าในตะกร้า</h2>
                    <p className="text-[10px] text-zinc-500 font-medium">ทั้งหมด {cartCount} ชิ้น จาก {cartItems.length} รายการ</p>
                  </div>
                </div>
                {cartItems.length > 0 && (
                  <span className="text-xs font-bold text-sky-400 bg-sky-500/10 px-3 py-1 rounded-lg border border-sky-500/10">
                    {cartTotal.toLocaleString()} THB
                  </span>
                )}
              </div>

              {/* Cart Items List */}
              {cartItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-28 text-zinc-500 gap-4 bg-zinc-950/25 border border-white/5 rounded-3xl">
                  <ShoppingBag className="w-16 h-16 stroke-[1.2] text-zinc-700" />
                  <div className="text-center space-y-1">
                    <p className="text-sm font-bold text-zinc-400">ยังไม่มีสินค้าในตะกร้า</p>
                    <p className="text-[11px] text-zinc-500 max-w-[280px] mx-auto">เลือกซื้อสินค้าที่หน้าร้านหลักเพื่อหยิบใส่ตะกร้าและทำการชำระเงิน</p>
                  </div>
                  <Link
                    href="/products"
                    className="flex items-center gap-2 text-xs font-bold bg-sky-500/10 text-sky-400 border border-sky-500/20 hover:bg-sky-500/20 px-5 py-2.5 rounded-xl transition-all cursor-pointer"
                  >
                    <ShoppingBag className="w-4 h-4" />
                    เลือกซื้อสินค้า
                  </Link>
                </div>
              ) : (
                <div className="space-y-3">
                  {cartItems.map((item) => {
                    const itemId = item._id || item.id;
                    const isMaxStock = item.quantity >= item.stock;
                    return (
                      <div
                        key={itemId}
                        className="bg-zinc-950/40 border border-white/5 rounded-3xl p-5 backdrop-blur-md flex flex-col sm:flex-row sm:items-center gap-4 transition-all hover:border-white/10"
                      >
                        {/* Thumbnail */}
                        <img
                          src={item.image || 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=100'}
                          alt={item.name}
                          className="w-16 h-16 rounded-2xl object-cover border border-white/5 shrink-0 bg-zinc-900"
                        />

                        {/* Item Info */}
                        <div className="flex-1 min-w-0 space-y-1.5">
                          <div className="flex items-center gap-2">
                            <span className="text-[9px] bg-sky-500/10 text-sky-400 px-1.5 py-0.5 rounded font-bold border border-sky-500/10 uppercase">
                              {item.subcategory}
                            </span>
                          </div>
                          <h4 className="text-sm font-bold text-white truncate">{item.name}</h4>
                          <div className="flex items-center gap-2 text-xs text-zinc-400">
                            <span className="font-bold text-sky-400">{item.price?.toLocaleString()} THB</span>
                            <span className="text-zinc-600">•</span>
                            <span className={isMaxStock ? 'text-amber-400 font-bold' : 'text-zinc-500'}>
                              {isMaxStock ? 'สต็อกเต็ม' : `คงเหลือ: ${item.stock} ชิ้น`}
                            </span>
                          </div>
                        </div>

                        {/* Quantity + Actions */}
                        <div className="flex items-center gap-3 sm:gap-4 shrink-0">
                          {/* Quantity controls */}
                          <div className="flex items-center gap-1.5 bg-zinc-900 border border-white/5 p-1.5 rounded-xl">
                            <button
                              onClick={() => updateQuantity(itemId, item.quantity - 1)}
                              disabled={item.quantity <= 1}
                              className="p-1.5 rounded-lg text-zinc-500 hover:text-white disabled:opacity-30 cursor-pointer transition-colors hover:bg-white/5"
                            >
                              <Minus className="w-3.5 h-3.5" />
                            </button>
                            <span className="text-sm font-bold text-white w-6 text-center font-mono">{item.quantity}</span>
                            <button
                              onClick={() => updateQuantity(itemId, item.quantity + 1)}
                              disabled={isMaxStock}
                              className={`p-1.5 rounded-lg transition-colors ${isMaxStock
                                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/10 cursor-not-allowed opacity-80'
                                : 'text-zinc-500 hover:text-white cursor-pointer hover:bg-white/5'
                                }`}
                              title={isMaxStock ? 'สินค้าในคลังมีไม่เพียงพอ' : 'เพิ่มจำนวน'}
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          {/* Item subtotal */}
                          <span className="text-sm font-black text-white font-mono min-w-[70px] text-right">
                            {(item.price * item.quantity).toLocaleString()} <span className="text-[10px] text-zinc-500 font-semibold">THB</span>
                          </span>

                          {/* Delete */}
                          <button
                            onClick={() => removeFromCart(itemId)}
                            className="p-2 rounded-xl text-zinc-500 hover:text-red-400 hover:bg-red-500/5 border border-transparent hover:border-red-500/10 transition-all cursor-pointer active:scale-90"
                            title="ลบออกจากตะกร้า"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Right Column: Summary & Checkout */}
            <div className="space-y-6 lg:col-span-1">

              {/* Order Summary Card */}
              {cartItems.length > 0 && (
                <div className="bg-zinc-950/40 border border-white/5 rounded-3xl p-6 backdrop-blur-md space-y-5 shadow-xl relative overflow-hidden group sticky top-24">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-sky-500/5 rounded-full blur-3xl group-hover:bg-sky-500/10 transition-all duration-500 pointer-events-none" />

                  <h3 className="text-xs text-zinc-500 font-bold uppercase tracking-wider">สรุปคำสั่งซื้อ</h3>

                  {/* Price Breakdown */}
                  <div className="space-y-2.5 text-xs text-zinc-400 font-sans">
                    <div className="flex justify-between">
                      <span>ราคารวมสินค้า ({cartCount} ชิ้น)</span>
                      <span className="text-zinc-200 font-mono font-bold">{cartTotal.toLocaleString()} THB</span>
                    </div>
                    {vipDiscountPercent > 0 && (
                      <div className="flex justify-between text-purple-400">
                        <span>ส่วนลด VIP ({vipDiscountPercent}%)</span>
                        <span className="font-mono font-bold">-{vipDiscountAmount.toLocaleString()} THB</span>
                      </div>
                    )}
                    {appliedCoupon && (
                      <div className="flex justify-between text-emerald-400">
                        <span>คูปอง ({appliedCoupon.code})</span>
                        <span className="font-mono font-bold">-{appliedCoupon.discount.toLocaleString()} THB</span>
                      </div>
                    )}
                  </div>

                  <div className="border-t border-white/5 pt-3 flex justify-between items-baseline">
                    <span className="text-sm font-bold text-white">ยอดชำระสุทธิ</span>
                    <span className="text-xl font-black text-sky-400 font-mono">{finalPrice.toLocaleString()} <span className="text-xs">THB</span></span>
                  </div>

                  {/* Coupon Input */}
                  {session && (
                    <div className="space-y-2.5 border-t border-white/5 pt-4">
                      <div className="flex items-center justify-between text-[11px] font-semibold text-zinc-400">
                        <span className="flex items-center gap-1">
                          <Tag className="w-3 h-3 text-sky-400" />
                          คูปองส่วนลด
                        </span>
                        {appliedCoupon && (
                          <span className="text-emerald-400">-{appliedCoupon.discount} บาท</span>
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
                            placeholder="ป้อนโค้ดส่วนลด"
                            className="flex-1 bg-[#03060d] border border-white/5 px-3 py-2 rounded-xl text-xs text-white placeholder-zinc-600 uppercase focus:outline-none focus:border-sky-500/30 transition-all"
                          />
                          <button
                            type="button"
                            disabled={validatingCoupon || !couponCodeInput}
                            onClick={async () => {
                              const success = await applyCartCoupon(couponCodeInput);
                              if (success) setCouponCodeInput('');
                            }}
                            className="bg-sky-500 text-sky-950 text-xs font-bold px-3 py-2 rounded-xl hover:bg-sky-400 transition-colors disabled:opacity-50 cursor-pointer active:scale-95"
                          >
                            {validatingCoupon ? <Loader2 className="w-4 h-4 animate-spin" /> : 'ใช้งาน'}
                          </button>
                        </div>
                      )}
                      {couponError && (
                        <span className="text-[10px] text-red-400 block font-sans">{couponError}</span>
                      )}
                    </div>
                  )}

                  {/* Balance info */}
                  {session && (
                    <div className="border-t border-white/5 pt-3 space-y-2">
                      <div className="flex items-center justify-between text-xs text-zinc-400">
                        <span className="flex items-center gap-1.5">
                          <Wallet className="w-3.5 h-3.5 text-sky-400" />
                          ยอดเงินคงเหลือ
                        </span>
                        <span className="font-mono font-bold text-sky-400">{session.user.balance?.toLocaleString()} THB</span>
                      </div>
                      {insufficientBalance && (
                        <div className="bg-red-500/10 border border-red-500/20 px-3 py-2 rounded-xl text-[10px] text-red-400 flex items-center gap-1.5">
                          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                          ยอดเงินไม่เพียงพอ กรุณาเติมเงินก่อนชำระ
                        </div>
                      )}
                    </div>
                  )}

                  {/* Checkout errors */}
                  {checkoutError && (
                    <div className="bg-red-500/10 border border-red-500/20 px-3 py-2 rounded-xl text-xs text-red-400 flex items-center gap-1.5 font-sans">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      {checkoutError}
                    </div>
                  )}

                  {/* Checkout Button */}
                  {session ? (
                    <button
                      onClick={handleCheckout}
                      disabled={insufficientBalance || checkoutMutation.isPending || cartItems.length === 0}
                      className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-bold transition-all cursor-pointer glow-btn disabled:opacity-50 disabled:cursor-not-allowed bg-sky-500 text-sky-950 hover:bg-sky-400 active:scale-[0.98]"
                    >
                      {checkoutMutation.isPending ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          กำลังชำระเงิน...
                        </>
                      ) : (
                        <>
                          <Wallet className="w-4 h-4" />
                          ชำระเงิน {finalPrice.toLocaleString()} THB
                        </>
                      )}
                    </button>
                  ) : (
                    <Link
                      href="/auth/signin"
                      className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-bold bg-sky-500 text-sky-950 hover:bg-sky-400 transition-all glow-btn"
                    >
                      <LogIn className="w-4 h-4" />
                      เข้าสู่ระบบเพื่อชำระเงิน
                    </Link>
                  )}

                  {/* Continue Shopping */}
                  <Link
                    href="/products"
                    className="w-full flex items-center justify-center gap-2 text-xs font-bold text-sky-400 bg-sky-500/10 border border-sky-500/20 hover:bg-sky-500/20 py-3 rounded-xl transition-all cursor-pointer"
                  >
                    <ShoppingBag className="w-4 h-4" />
                    เลือกซื้อสินค้าต่อ
                  </Link>
                </div>
              )}

              {/* Topup shortcut (when cart has items and balance is low) */}
              {session && insufficientBalance && (
                <Link
                  href="/topup"
                  className="flex items-center justify-center gap-2 text-xs font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 hover:bg-amber-500/20 py-3 rounded-xl transition-all cursor-pointer"
                >
                  <Wallet className="w-4 h-4" />
                  เติมเงินเข้ากระเป๋า
                </Link>
              )}
            </div>

          </div>
        )}

        {/* ─── Recommended Products Section ─── */}
        {session && !checkoutSuccess && recommendedProducts.length > 0 && (
          <div className="space-y-5 pt-4">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-sky-400" />
              <h2 className="text-lg font-black text-white">สินค้าแนะนำสำหรับคุณ</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {recommendedProducts.map((product) => (
                <div
                  key={product._id || product.id}
                  onClick={() => setSelectedProduct(product)}
                  className="bg-zinc-950/40 border border-white/5 rounded-3xl p-4 backdrop-blur-md space-y-3 transition-all hover:border-white/10 hover:bg-zinc-950/60 cursor-pointer group"
                >
                  <div className="relative overflow-hidden rounded-2xl">
                    <img
                      src={product.image || 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=300'}
                      alt={product.name}
                      className="w-full h-36 object-cover bg-zinc-900 group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute top-2 left-2">
                      <span className="text-[9px] bg-sky-500/20 text-sky-400 px-2 py-0.5 rounded-lg font-bold border border-sky-500/10 uppercase backdrop-blur-sm">
                        {product.subcategory}
                      </span>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-xs font-bold text-white truncate group-hover:text-sky-400 transition-colors">{product.name}</h4>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-black text-sky-400 font-mono">{product.price?.toLocaleString()} THB</span>
                      <span className="text-[10px] text-zinc-500 flex items-center gap-1">
                        <Package className="w-3 h-3" />
                        {product.stock} ชิ้น
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </main>

      <Footer />

      {/* Product Detail Modal */}
      {selectedProduct && (
        <ProductDetailModal
          product={selectedProduct}
          onClose={() => setSelectedProduct(null)}
        />
      )}
    </div>
  );
}
