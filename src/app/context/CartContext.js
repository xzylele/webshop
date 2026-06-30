'use client';

import { createContext, useContext, useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { getUserRank } from '@/lib/ranks';

const CartContext = createContext(null);

export function CartProvider({ children }) {
  const { data: session } = useSession();
  const [cartItems, setCartItems] = useState([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // Coupon state for cart
  const [appliedCoupon, setAppliedCoupon] = useState(null); // stores { code, discount, type, rawDiscount, maxDiscount }
  const [couponError, setCouponError] = useState('');
  const [validatingCoupon, setValidatingCoupon] = useState(false);

  // 1. Load cart from localStorage on mount (prevents hydration mismatch)
  useEffect(() => {
    const savedCart = localStorage.getItem('nakata_cart');
    if (savedCart) {
      try {
        const parsed = JSON.parse(savedCart);
        if (Array.isArray(parsed)) {
          // Auto-heal: filter out invalid items that don't have id/name (prevents display glitches with stale data)
          const validItems = parsed.filter(item => item && (item.id || item._id) && item.name);
          setCartItems(validItems);
        }
      } catch (e) {
        console.error('Failed to parse cart items:', e);
      }
    }
    setIsLoaded(true);
  }, []);

  // 2. Save cart to localStorage on changes
  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem('nakata_cart', JSON.stringify(cartItems));
    }
  }, [cartItems, isLoaded]);

  // 3. Helper calculations
  const cartCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);
  const cartTotal = cartItems.reduce((sum, item) => sum + (Number(item.price) * item.quantity), 0);

  // 4. VIP Rank calculations
  const userRank = session?.user ? getUserRank(session.user.totalSpent || 0) : null;
  const vipDiscountPercent = userRank ? userRank.discountPercent : 0;
  const vipDiscountAmount = Math.round(cartTotal * (vipDiscountPercent / 100));
  const priceAfterVip = cartTotal - vipDiscountAmount;

  // 5. Auto re-validate coupon if total price changes
  useEffect(() => {
    if (appliedCoupon && isLoaded) {
      const revalidateCoupon = async () => {
        try {
          const res = await fetch('/api/coupons/validate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              code: appliedCoupon.code,
              totalPrice: priceAfterVip
            }),
          });
          const data = await res.json();
          if (res.ok) {
            setAppliedCoupon({
              code: data.code,
              discount: data.discount,
              type: data.type,
              rawDiscount: data.rawDiscount,
              maxDiscount: data.maxDiscount
            });
            setCouponError('');
          } else {
            setCouponError(data.error || 'คูปองใช้ไม่ได้เนื่องจากเงื่อนไขราคารวมเปลี่ยนไป');
            setAppliedCoupon(null);
          }
        } catch (e) {
          setAppliedCoupon(null);
        }
      };
      revalidateCoupon();
    }
  }, [cartTotal, isLoaded]);

  // 6. Cart Management methods
  const addToCart = (product, quantity = 1) => {
    const productId = product._id || product.id;
    if (!productId) return;

    setCartItems((prevItems) => {
      const existingItemIndex = prevItems.findIndex((item) => (item._id || item.id) === productId);
      if (existingItemIndex > -1) {
        const nextItems = [...prevItems];
        const newQty = nextItems[existingItemIndex].quantity + quantity;
        // Limit quantity to stock
        nextItems[existingItemIndex].quantity = Math.min(newQty, product.stock);
        return nextItems;
      } else {
        // Limit initial quantity to stock
        const initialQty = Math.min(quantity, product.stock);
        // Normalize product to guarantee it has both properties
        const normalizedProduct = {
          ...product,
          id: productId,
          _id: productId,
          quantity: initialQty
        };
        return [...prevItems, normalizedProduct];
      }
    });
  };

  const removeFromCart = (productId) => {
    setCartItems((prevItems) => prevItems.filter((item) => (item._id || item.id) !== productId));
  };

  const updateQuantity = (productId, quantity) => {
    setCartItems((prevItems) =>
      prevItems.map((item) => {
        if ((item._id || item.id) === productId) {
          const validQty = Math.max(1, Math.min(quantity, item.stock));
          return { ...item, quantity: validQty };
        }
        return item;
      })
    );
  };

  const clearCart = () => {
    setCartItems([]);
    setAppliedCoupon(null);
    setCouponError('');
  };

  // 7. Coupon methods
  const applyCartCoupon = async (code) => {
    if (!code) return;
    setCouponError('');
    setValidatingCoupon(true);

    try {
      const res = await fetch('/api/coupons/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          code,
          totalPrice: priceAfterVip
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'คูปองไม่ถูกต้อง');
      }

      setAppliedCoupon({
        code: data.code,
        discount: data.discount,
        type: data.type,
        rawDiscount: data.rawDiscount,
        maxDiscount: data.maxDiscount
      });
      return true;
    } catch (err) {
      setCouponError(err.message);
      setAppliedCoupon(null);
      return false;
    } finally {
      setValidatingCoupon(false);
    }
  };

  const removeCartCoupon = () => {
    setAppliedCoupon(null);
    setCouponError('');
  };

  return (
    <CartContext.Provider
      value={{
        cartItems,
        isLoaded,
        cartCount,
        cartTotal,
        vipDiscountPercent,
        vipDiscountAmount,
        priceAfterVip,
        appliedCoupon,
        couponError,
        validatingCoupon,
        addToCart,
        removeFromCart,
        updateQuantity,
        clearCart,
        applyCartCoupon,
        removeCartCoupon,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}
