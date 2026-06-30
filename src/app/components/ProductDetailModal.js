'use client';

import { useState, useEffect } from 'react';
import { X, ShoppingCart, Loader2, AlertCircle, CheckCircle, Copy, Check, Tag } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import { getUserRank } from '@/lib/ranks';
import Link from 'next/link';
import { useCart } from '../context/CartContext';

export default function ProductDetailModal({ product, isOpen, onClose }) {
  const { addToCart } = useCart();
  const { data: session, update: updateSession } = useSession();
  const [quantity, setQuantity] = useState(1);
  const [buySuccess, setBuySuccess] = useState(null); // stores purchase result
  const [copiedIdx, setCopiedIdx] = useState(null);
  
  // Coupon State
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState(null); // stores { code, discount }
  const [couponError, setCouponError] = useState('');
  const [validatingCoupon, setValidatingCoupon] = useState(false);

  const queryClient = useQueryClient();

  // Buy Product mutation
  const mutation = useMutation({
    mutationFn: async (payload) => {
      const res = await fetch('/api/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'เกิดข้อผิดพลาดในการซื้อสินค้า');
      return data;
    },
    onSuccess: (data) => {
      setBuySuccess(data);
      // อัปเดตข้อมูล Session เงินในกระเป๋า และ ยอดใช้สะสม
      updateSession({ refresh: true });
      // อัปเดตข้อมูลคลังสินค้าใหม่
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
    },
  });

  const handleApplyCoupon = async () => {
    if (!couponCode) return;
    setCouponError('');
    setValidatingCoupon(true);

    const basePrice = product.price * quantity;
    const userRank = session?.user ? getUserRank(session.user.totalSpent || 0) : null;
    const vipDiscountPercent = userRank ? userRank.discountPercent : 0;
    const vipDiscountAmount = Math.round(basePrice * (vipDiscountPercent / 100));
    const currentPrice = basePrice - vipDiscountAmount;

    try {
      const res = await fetch('/api/coupons/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          code: couponCode,
          totalPrice: currentPrice
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'รหัสคูปองไม่ถูกต้อง');
      }

      setAppliedCoupon({
        code: data.code,
        discount: data.discount,
      });
    } catch (err) {
      setCouponError(err.message);
      setAppliedCoupon(null);
    } finally {
      setValidatingCoupon(false);
    }
  };

  // ดึงสิทธิ์คำนวณและปรับเปลี่ยนราคาคูปองใหม่เมื่อมีการเปลี่ยนจำนวนสินค้า (กรณีใช้คูปองแบบ %)
  useEffect(() => {
    if (appliedCoupon) {
      const reapplyCoupon = async () => {
        const basePrice = product.price * quantity;
        const userRank = session?.user ? getUserRank(session.user.totalSpent || 0) : null;
        const vipDiscountPercent = userRank ? userRank.discountPercent : 0;
        const vipDiscountAmount = Math.round(basePrice * (vipDiscountPercent / 100));
        const currentPrice = basePrice - vipDiscountAmount;

        try {
          const res = await fetch('/api/coupons/validate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              code: appliedCoupon.code,
              totalPrice: currentPrice
            }),
          });
          const data = await res.json();
          if (res.ok) {
            setAppliedCoupon({
              code: data.code,
              discount: data.discount,
            });
          } else {
            setCouponError(data.error || 'ยอดสั่งซื้อขั้นต่ำไม่เพียงพอกับเงื่อนไขคูปองสำหรับจำนวนนี้');
            setAppliedCoupon(null);
          }
        } catch (err) {
          setAppliedCoupon(null);
        }
      };
      reapplyCoupon();
    }
  }, [quantity]);

  const handleRemoveCoupon = () => {
    setCouponCode('');
    setAppliedCoupon(null);
    setCouponError('');
  };

  const handlePurchase = () => {
    if (!session) return;
    mutation.mutate({
      productId: product._id,
      quantity,
      couponCode: appliedCoupon ? appliedCoupon.code : undefined,
    });
  };

  const handleCopy = (text, idx) => {
    navigator.clipboard.writeText(text);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  const handleClose = () => {
    setQuantity(1);
    setBuySuccess(null);
    setCouponCode('');
    setAppliedCoupon(null);
    setCouponError('');
    mutation.reset();
    onClose();
  };

  if (!isOpen || !product) return null;

  // คำนวณราคารวมเบื้องต้น
  const totalPrice = product.price * quantity;

  // คำนวณหาส่วนลดยศ VIP Rank
  const userRank = session?.user ? getUserRank(session.user.totalSpent || 0) : null;
  const vipDiscountPercent = userRank ? userRank.discountPercent : 0;
  const vipDiscountAmount = Math.round(totalPrice * (vipDiscountPercent / 100));

  // คำนวณยอดชำระสุทธิ
  const couponDiscount = appliedCoupon ? appliedCoupon.discount : 0;
  const finalPrice = Math.max(0, totalPrice - vipDiscountAmount - couponDiscount);
  const isOutOfStock = product.stock <= 0;
  const insufficientBalance = session && session.user.balance < finalPrice;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="absolute inset-0" onClick={handleClose} />

      <div className="relative w-full max-w-lg bg-[#060c13] border border-white/5 p-6 rounded-2xl shadow-2xl glass z-10 overflow-hidden transition-all animate-in fade-in zoom-in-95 duration-200">
        
        {/* Glow behind */}
        <div className="absolute -top-12 -right-12 w-32 h-32 bg-sky-500/10 rounded-full blur-2xl" />

        {/* Close Button */}
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg border border-white/5 text-zinc-400 hover:text-white hover:bg-white/5 cursor-pointer transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Main Content Render */}
        {buySuccess ? (
          /* SUCCESS SCREEN */
          <div className="text-center py-6 space-y-6">
            <div className="inline-flex bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-full text-emerald-400 mx-auto animate-bounce">
              <CheckCircle className="w-12 h-12" />
            </div>

            <div className="space-y-1.5">
              <h2 className="text-xl font-bold text-white">สั่งซื้อสินค้าสำเร็จ!</h2>
              <p className="text-xs text-zinc-400">
                คุณได้รับรหัส/ข้อมูลสมาชิกสำหรับใช้บริการเรียบร้อยแล้ว
              </p>
            </div>

            {/* Received Codes Box */}
            <div className="bg-zinc-950/60 border border-white/5 p-4 rounded-xl text-left space-y-2.5 max-h-[220px] overflow-y-auto">
              <span className="text-[10px] uppercase font-bold text-sky-400 tracking-wider">
                ข้อมูลรหัส / บัญชีที่ได้รับ
              </span>
              
              {buySuccess.receivedCodes?.map((code, idx) => (
                <div 
                  key={idx} 
                  className="flex items-center justify-between gap-3 bg-white/5 border border-white/5 px-3.5 py-2.5 rounded-lg text-xs font-mono text-zinc-200"
                >
                  <span className="break-all">{code}</span>
                  <button
                    onClick={() => handleCopy(code, idx)}
                    className="shrink-0 text-sky-400 hover:text-sky-300 p-1.5 hover:bg-white/5 rounded transition-colors cursor-pointer"
                  >
                    {copiedIdx === idx ? (
                      <Check className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>
                </div>
              ))}
            </div>

            <div className="text-xs text-zinc-500">
              * ข้อมูลนี้ได้รับการบันทึกในประวัติการซื้อของคุณแล้ว สามารถกลับมาเปิดดูได้ทุกเมื่อ
            </div>

            <button
              onClick={handleClose}
              className="w-full bg-emerald-500 text-emerald-950 hover:bg-emerald-400 py-3 rounded-xl font-bold transition-all cursor-pointer"
            >
              เสร็จสิ้น
            </button>
          </div>
        ) : (
          /* BUY/PREVIEW SCREEN */
          <div className="space-y-5">
            
            {/* Header: Product Preview info */}
            <div className="flex gap-4 items-start">
              <img
                src={product.image}
                alt={product.name}
                className="w-20 h-20 rounded-xl object-cover border border-white/5"
              />
              <div className="space-y-1">
                <span className="text-[10px] px-2 py-0.5 bg-sky-500/10 text-sky-400 font-semibold rounded border border-sky-500/10">
                  {product.subcategory}
                </span>
                <h3 className="text-sm font-bold text-white leading-snug">{product.name}</h3>
                <p className="text-[10px] text-zinc-400 leading-normal">{product.description}</p>
              </div>
            </div>

            {/* Quantity select */}
            <div className="flex items-center justify-between bg-zinc-950/40 border border-white/5 p-4 rounded-2xl">
              <div>
                <span className="text-xs font-semibold text-white block">ระบุจำนวนที่ต้องการสั่งซื้อ</span>
                <span className="text-[10px] text-zinc-500">
                  {product.stockType === 'code' 
                    ? `คีย์พร้อมส่งทั้งหมด: ${product.stock} ชิ้น` 
                    : `สต็อกที่มีอยู่: ${product.stock} ชิ้น`}
                </span>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  disabled={quantity <= 1}
                  onClick={() => setQuantity(q => q - 1)}
                  className="w-8 h-8 flex items-center justify-center rounded-lg border border-white/5 text-zinc-400 hover:text-white hover:bg-white/5 disabled:opacity-40 transition-colors cursor-pointer"
                >
                  -
                </button>
                <span className="text-sm font-bold text-white w-6 text-center">{quantity}</span>
                <button
                  type="button"
                  disabled={quantity >= product.stock}
                  onClick={() => setQuantity(q => q + 1)}
                  className="w-8 h-8 flex items-center justify-center rounded-lg border border-white/5 text-zinc-400 hover:text-white hover:bg-white/5 disabled:opacity-40 transition-colors cursor-pointer"
                >
                  +
                </button>
              </div>
            </div>

            {/* Coupon Code input */}
            {session && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold text-zinc-400">
                  <span className="flex items-center gap-1">
                    <Tag className="w-3.5 h-3.5 text-sky-400" />
                    คูปองโค้ดส่วนลด
                  </span>
                  {appliedCoupon && (
                    <span className="text-emerald-400">ลดราคาแล้ว: -{couponDiscount} บาท</span>
                  )}
                </div>
                
                {appliedCoupon ? (
                  <div className="flex items-center justify-between bg-emerald-500/10 border border-emerald-500/20 px-3.5 py-2.5 rounded-xl text-xs text-emerald-400">
                    <span className="font-mono font-bold tracking-wider">{appliedCoupon.code}</span>
                    <button
                      type="button"
                      onClick={handleRemoveCoupon}
                      className="text-red-400 hover:text-red-300 font-semibold cursor-pointer"
                    >
                      ยกเลิก
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={couponCode}
                      onChange={(e) => setCouponCode(e.target.value)}
                      placeholder="ป้อนรหัสคูปอง เช่น GACHA-XXXX"
                      className="flex-1 bg-[#03060d] border border-white/5 px-3.5 py-2 rounded-xl text-xs text-white placeholder-zinc-500 uppercase focus:outline-none focus:border-sky-500/30"
                    />
                    <button
                      type="button"
                      disabled={validatingCoupon || !couponCode}
                      onClick={handleApplyCoupon}
                      className="bg-sky-500 text-sky-950 hover:bg-sky-400 font-bold px-4 py-2 rounded-xl text-xs disabled:opacity-50 transition-colors cursor-pointer"
                    >
                      {validatingCoupon ? '...' : 'ใช้งาน'}
                    </button>
                  </div>
                )}
                {couponError && (
                  <p className="text-[10px] text-red-400 font-semibold">{couponError}</p>
                )}
              </div>
            )}

            {/* Error notifications */}
            {mutation.isError && (
              <div className="bg-red-500/10 border border-red-500/20 px-4 py-3 rounded-xl text-xs text-red-400 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{mutation.error.message}</span>
              </div>
            )}

            {/* Purchase CTA */}
            {session ? (
              <div className="space-y-3">
                {insufficientBalance && (
                  <div className="bg-amber-500/10 border border-amber-500/20 px-3.5 py-2.5 rounded-xl text-xs text-amber-400 flex items-center gap-2">
                    <AlertCircle className="w-4.5 h-4.5 shrink-0" />
                    <span>ยอดเงินไม่เพียงพอ (ขาดอีก {(finalPrice - session.user.balance).toLocaleString()} THB)</span>
                  </div>
                )}

                {/* รายการแสดงบิลราคารายตัว */}
                <div className="bg-zinc-950/40 border border-white/5 p-4 rounded-2xl space-y-2 text-xs">
                  <div className="flex justify-between items-center text-zinc-400">
                    <span>ราคารวมเบื้องต้น ({quantity} ชิ้น):</span>
                    <span>{totalPrice.toLocaleString()} THB</span>
                  </div>
                  {vipDiscountAmount > 0 && userRank && (
                    <div className="flex justify-between items-center text-purple-400 font-semibold">
                      <span>ส่วนลดยศ VIP ({userRank.badge} {vipDiscountPercent}%):</span>
                      <span>-{vipDiscountAmount.toLocaleString()} THB</span>
                    </div>
                  )}
                  {couponDiscount > 0 && (
                    <div className="flex justify-between items-center text-emerald-400 font-semibold">
                      <span>คูปองลดเพิ่ม:</span>
                      <span>-{couponDiscount.toLocaleString()} THB</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center text-white font-bold border-t border-white/5 pt-2 mt-1">
                    <span>ยอดชำระสุทธิ:</span>
                    <span className="text-sm text-sky-400">{finalPrice.toLocaleString()} THB</span>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      addToCart(product, quantity);
                      handleClose();
                    }}
                    disabled={isOutOfStock}
                    className="flex-1 flex items-center justify-center gap-1.5 bg-zinc-900 border border-white/5 text-zinc-300 hover:text-white font-bold py-3 rounded-xl hover:bg-zinc-800 transition-all text-xs disabled:opacity-50 cursor-pointer"
                  >
                    <span>ใส่ตะกร้า</span>
                  </button>

                  {insufficientBalance ? (
                    <Link
                      href="/topup"
                      onClick={handleClose}
                      className="flex-1 flex items-center justify-center bg-amber-500 text-amber-950 font-bold py-3 rounded-xl hover:bg-amber-400 transition-all glow-btn text-xs"
                    >
                      เติมเงินเข้าระบบ
                    </Link>
                  ) : (
                    <button
                      type="button"
                      onClick={handlePurchase}
                      disabled={isOutOfStock || mutation.isPending}
                      className="flex-1.5 flex items-center justify-center gap-1.5 bg-sky-500 text-sky-950 font-bold py-3 rounded-xl hover:bg-sky-400 hover:scale-[1.01] transition-all glow-btn text-xs disabled:opacity-50 cursor-pointer"
                    >
                      {mutation.isPending ? (
                        <Loader2 className="w-4.5 h-4.5 animate-spin" />
                      ) : (
                        <>
                          <ShoppingCart className="w-4.5 h-4.5" />
                          <span>ซื้อสินค้าทันที</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-zinc-950/40 border border-white/5 p-4 rounded-xl text-center space-y-3">
                <p className="text-xs text-zinc-400">กรุณาเข้าสู่ระบบเพื่อซื้อสินค้าชิ้นนี้</p>
                <div className="flex gap-2 justify-center">
                  <Link
                    href="/auth/signin"
                    onClick={handleClose}
                    className="bg-sky-500 text-sky-950 text-xs font-bold px-4 py-2 rounded-xl transition-all"
                  >
                    เข้าสู่ระบบ
                  </Link>
                  <Link
                    href="/auth/signup"
                    onClick={handleClose}
                    className="border border-white/5 hover:bg-white/5 text-xs text-zinc-300 px-4 py-2 rounded-xl transition-colors"
                  >
                    สมัครสมาชิก
                  </Link>
                </div>
              </div>
            )}

          </div>
        )}

      </div>
    </div>
  );
}
