import { supabaseAdmin } from '@/lib/supabase';
import { getUserRank } from '@/lib/ranks';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]/route';
import { NextResponse } from 'next/server';

function generateProductCode(subcategory) {
  if (['Netflix', 'Disneyplus', 'Spotify'].includes(subcategory)) {
    const mockEmail = `nakatashop_acc_${Math.random().toString(36).substr(2, 6)}@gmail.com`;
    const mockPass = Math.random().toString(36).substr(2, 8);
    return `บัญชี: ${mockEmail} | รหัสผ่าน: ${mockPass} (สำหรับเคลมกรุณาแคปหน้าจอ)`;
  } else {
    const segments = [];
    for (let i = 0; i < 4; i++) {
      segments.push(Math.random().toString(36).substr(2, 4).toUpperCase());
    }
    return `รหัสโค้ด: ${segments.join('-')}`;
  }
}

export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบก่อนทำรายการ' }, { status: 401 });
    }

    const { items, couponCode } = await request.json();

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'ไม่พบรายการสินค้าในตะกร้า' }, { status: 400 });
    }

    // ดึงข้อมูลผู้ใช้งานล่าสุด
    const { data: user, error: userErr } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('id', session.user.id)
      .maybeSingle();

    if (userErr) throw userErr;
    if (!user) {
      return NextResponse.json({ error: 'ไม่พบข้อมูลผู้ใช้งาน' }, { status: 404 });
    }

    // ดึงข้อมูลของสินค้าแต่ละรายการและตรวจสอบสต็อกเบื้องต้น
    const purchaseDetails = [];
    let totalPrice = 0;

    for (const item of items) {
      const { productId, quantity } = item;
      const qty = Number(quantity) || 1;

      if (!productId || qty <= 0) {
        return NextResponse.json({ error: 'ข้อมูลสินค้าในตะกร้าไม่ถูกต้อง' }, { status: 400 });
      }

      const { data: product, error: prodErr } = await supabaseAdmin
        .from('products')
        .select('*')
        .eq('id', productId)
        .maybeSingle();

      if (prodErr) throw prodErr;
      if (!product) {
        return NextResponse.json({ error: `ไม่พบสินค้าไอดี ${productId} ในระบบ` }, { status: 404 });
      }

      // ตรวจสอบสต็อกตามประเภทสินค้า
      if (product.stock_type === 'code') {
        const { count, error: countErr } = await supabaseAdmin
          .from('product_codes')
          .select('*', { count: 'exact', head: true })
          .eq('product_id', product.id)
          .eq('is_used', false);

        if (countErr) throw countErr;
        if (count < qty) {
          return NextResponse.json({ error: `สินค้า "${product.name}" มีจำนวนคีย์ไม่เพียงพอ (เหลือ ${count} คีย์)` }, { status: 400 });
        }
      } else {
        if (Number(product.stock) < qty) {
          return NextResponse.json({ error: `สินค้า "${product.name}" ในสต็อกมีจำนวนไม่เพียงพอ (เหลือ ${product.stock} ชิ้น)` }, { status: 400 });
        }
      }

      totalPrice += Number(product.price) * qty;
      purchaseDetails.push({ product, qty });
    }

    // คำนวณหา Rank และส่วนลดระดับ VIP ของผู้ใช้
    const userRank = getUserRank(Number(user.total_spent) || 0);
    const rankDiscountPercent = userRank.discountPercent || 0;
    const rankDiscountAmount = Math.round(totalPrice * (rankDiscountPercent / 100));

    // หักส่วนลด Rank ออกก่อนนำไปคิดร่วมกับคูปอง
    let finalPrice = totalPrice - rankDiscountAmount;
    let couponUsed = null;
    let couponDiscountAmount = 0;

    if (couponCode) {
      const normalizedCode = couponCode.trim().toUpperCase();
      const { data: coupon, error: couponErr } = await supabaseAdmin
        .from('coupons')
        .select('*')
        .eq('code', normalizedCode)
        .eq('is_active', true)
        .maybeSingle();

      if (couponErr) throw couponErr;
      if (!coupon) {
        return NextResponse.json({ error: 'รหัสคูปองไม่ถูกต้อง หรือ ถูกปิดใช้งานไปแล้ว' }, { status: 400 });
      }

      // 1. ตรวจสอบวันหมดอายุ
      if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) {
        return NextResponse.json({ error: 'รหัสคูปองนี้หมดอายุการใช้งานแล้ว' }, { status: 400 });
      }

      // 2. ตรวจสอบยอดซื้อขั้นต่ำ
      if (finalPrice < Number(coupon.min_purchase)) {
        return NextResponse.json({ 
          error: `ยอดซื้อสุทธิของคุณไม่ถึงขั้นต่ำสำหรับใช้คูปองนี้ (ขั้นต่ำคือ ${coupon.min_purchase} บาท)` 
        }, { status: 400 });
      }

      // 3. ตรวจสอบสิทธิ์ใช้งานสูงสุดต่อคน
      const { count, error: countErr } = await supabaseAdmin
        .from('transactions')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('coupon_id', coupon.id);

      if (countErr) throw countErr;

      const maxUses = coupon.max_uses_per_user || 1;
      if (count !== null && count >= maxUses) {
        return NextResponse.json({ 
          error: `คุณใช้สิทธิ์คูปองนี้ครบจำนวนแล้ว (จำกัด ${maxUses} ครั้งต่อคน)` 
        }, { status: 400 });
      }

      couponUsed = coupon;

      // 4. คำนวณยอดส่วนลด
      if (coupon.type === 'percentage') {
        couponDiscountAmount = Math.round(finalPrice * (Number(coupon.discount) / 100));
        if (coupon.max_discount) {
          couponDiscountAmount = Math.min(couponDiscountAmount, Number(coupon.max_discount));
        }
      } else {
        couponDiscountAmount = Number(coupon.discount);
      }

      finalPrice = Math.max(0, finalPrice - couponDiscountAmount);
    }

    if (Number(user.balance) < finalPrice) {
      return NextResponse.json({ error: 'ยอดเงินคงเหลือของคุณไม่เพียงพอ กรุณาเติมเงิน' }, { status: 400 });
    }

    // ดำเนินการชำระเงินและแจกแจงโค้ด
    const nextBalance = Number(user.balance) - finalPrice;
    const nextTotalSpent = (Number(user.total_spent) || 0) + finalPrice;

    // 1. หักยอดเงิน และสะสมยอดใช้จ่ายจริง
    const { error: userUpdateErr } = await supabaseAdmin
      .from('users')
      .update({
        balance: nextBalance,
        total_spent: nextTotalSpent
      })
      .eq('id', user.id);

    if (userUpdateErr) throw userUpdateErr;

    // 2. ดำเนินการอัปเดตแต่ละรายการสินค้าและรวบรวมรหัสโค้ด
    const allPurchasedCodes = []; // array of { productName, codes: [] }
    const transactionDetails = []; // string list for description

    for (const detail of purchaseDetails) {
      const { product, qty } = detail;
      let purchasedCodes = [];
      let codesInDb = [];

      if (product.stock_type === 'code') {
        // ดึงคีย์โค้ดจากคลัง
        const { data: fetchCodes, error: fetchCodesErr } = await supabaseAdmin
          .from('product_codes')
          .select('*')
          .eq('product_id', product.id)
          .eq('is_used', false)
          .order('created_at', { ascending: true })
          .limit(qty);

        if (fetchCodesErr) throw fetchCodesErr;
        codesInDb = fetchCodes || [];

        if (codesInDb.length < qty) {
          throw new Error(`โค้ดสินค้า "${product.name}" ในสต็อกหมดกะทันหัน`);
        }
        purchasedCodes = codesInDb.map(c => c.code);
      } else {
        // สต็อกแบบแมนนวล -> สุ่มสร้างโค้ด
        for (let i = 0; i < qty; i++) {
          purchasedCodes.push(generateProductCode(product.subcategory));
        }
      }

      // อัปเดตยอดจำหน่าย/สต็อกของสินค้า
      const productUpdates = {
        sold: Number(product.sold) + qty
      };
      if (product.stock_type === 'manual') {
        productUpdates.stock = Number(product.stock) - qty;
      }

      const { error: productUpdateErr } = await supabaseAdmin
        .from('products')
        .update(productUpdates)
        .eq('id', product.id);

      if (productUpdateErr) throw productUpdateErr;

      allPurchasedCodes.push({
        productName: product.name,
        codes: purchasedCodes,
        stockType: product.stock_type,
        codeIds: codesInDb.map(c => c.id)
      });

      transactionDetails.push(`- ${product.name} x${qty}\n  [รหัสโค้ด]:\n  ${purchasedCodes.join('\n  ')}`);
    }

    // บันทึกรายละเอียดในคำอธิบาย Transaction
    const rankDesc = rankDiscountPercent > 0 ? `\n(ส่วนลด VIP Rank [${userRank.name} ${rankDiscountPercent}%] -${rankDiscountAmount} บาท)` : '';
    const couponDesc = couponUsed ? `\n(ใช้คูปอง ${couponUsed.code} ลด ${couponDiscountAmount} บาท)` : '';
    const description = `ชำระเงินตะกร้าสินค้า (รวมยอดหลังหักส่วนลด VIP และคูปอง)\n${transactionDetails.join('\n')}${rankDesc}${couponDesc}`;

    // 3. บันทึกประวัติ Transaction การซื้อ
    const { data: transaction, error: txError } = await supabaseAdmin
      .from('transactions')
      .insert([
        {
          user_id: user.id,
          type: 'purchase',
          amount: -finalPrice,
          description,
          status: 'completed',
          coupon_id: couponUsed ? couponUsed.id : null
        }
      ])
      .select('*')
      .single();

    if (txError) throw txError;

    // 4. อัปเดตสถานะคีย์ที่ขายออกไปใน product_codes
    for (const codeBatch of allPurchasedCodes) {
      if (codeBatch.stockType === 'code' && codeBatch.codeIds.length > 0) {
        const { error: codeUpdateErr } = await supabaseAdmin
          .from('product_codes')
          .update({
            is_used: true,
            used_by: user.id,
            transaction_id: transaction.id
          })
          .in('id', codeBatch.codeIds);

        if (codeUpdateErr) throw codeUpdateErr;
      }
    }

    return NextResponse.json({
      message: 'ชำระเงินตะกร้าสินค้าเรียบร้อยแล้ว!',
      newBalance: nextBalance,
      newTotalSpent: nextTotalSpent,
      transaction,
      purchasedItems: allPurchasedCodes.map(batch => ({
        productName: batch.productName,
        receivedCodes: batch.codes
      }))
    });

  } catch (error) {
    console.error('Cart Checkout error:', error);
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการประมวลผลคำสั่งซื้อตะกร้าสินค้า' }, { status: 500 });
  }
}
