import { supabaseAdmin } from '@/lib/supabase';
import { getUserRank } from '@/lib/ranks';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]/route';
import { NextResponse } from 'next/server';
import { notifyPurchase, checkAndNotifyLowStock } from '@/lib/adminNotifications';

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

    const { productId, quantity, couponCode } = await request.json();
    const qty = Number(quantity) || 1;

    if (!productId) {
      return NextResponse.json({ error: 'กรุณาระบุสินค้าที่ต้องการซื้อ' }, { status: 400 });
    }

    if (qty <= 0) {
      return NextResponse.json({ error: 'จำนวนที่ซื้อต้องมากกว่า 0' }, { status: 400 });
    }

    // ดึงข้อมูลสินค้า
    const { data: product, error: prodErr } = await supabaseAdmin
      .from('products')
      .select('*')
      .eq('id', productId)
      .maybeSingle();

    if (prodErr) throw prodErr;
    if (!product) {
      return NextResponse.json({ error: 'ไม่พบสินค้าในระบบ' }, { status: 404 });
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

    // คำนวณราคารวมขั้นต้น
    const totalPrice = Number(product.price) * qty;

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
      
      // ค้นหาคูปอง: ค้นหาทั้งแบบคูปองส่วนตัวของลูกค้า (มี #USER_ID) และแบบสาธารณะ
      const { data: coupons, error: couponErr } = await supabaseAdmin
        .from('coupons')
        .select('*')
        .or(`code.eq.${normalizedCode},code.like.${normalizedCode}#%`)
        .eq('is_active', true);

      if (couponErr) throw couponErr;

      let coupon = null;
      if (coupons && coupons.length > 0) {
        // 1. หาแบบคูปองส่วนตัวที่ผูกกับ user
        coupon = coupons.find(c => c.code === `${normalizedCode}#${user.id}`);
        // 2. ถ้าไม่เจอ ค่อยหาแบบสาธารณะ
        if (!coupon) {
          coupon = coupons.find(c => {
            const parts = c.code.split('#');
            const suffix = parts[1];
            return !suffix || /^[0-9]+$/.test(suffix);
          });
        }
      }

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

      // 4. ตรวจสอบสิทธิ์การใช้ของทั้งระบบ (ถ้ามีขีดจำกัดสูงสุดระบุไว้)
      const parts = coupon.code.split('#');
      const suffix = parts[1];
      const maxTotalUses = suffix && /^[0-9]+$/.test(suffix) ? parseInt(suffix, 10) : null;
      if (maxTotalUses !== null) {
        const relatedCouponIds = coupons.map(c => c.id);
        const { count: totalUsesCount, error: countErr } = await supabaseAdmin
          .from('transactions')
          .select('*', { count: 'exact', head: true })
          .in('coupon_id', relatedCouponIds);

        if (countErr) throw countErr;

        if (totalUsesCount >= maxTotalUses) {
          return NextResponse.json({ error: 'ขออภัย คูปองนี้ถูกสิทธิ์ผู้ใช้งานครบเต็มจำนวนทั้งหมดแล้ว' }, { status: 400 });
        }
      }

      couponUsed = coupon;

      // 5. คำนวณยอดส่วนลด
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

    let purchasedCodes = [];
    let codesInDb = [];

    if (product.stock_type === 'code') {
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
        return NextResponse.json({ error: 'สินค้าในคลังไม่เพียงพอ (สต็อกรหัสโค้ดหมด)' }, { status: 400 });
      }
      purchasedCodes = codesInDb.map(c => c.code);
    } else {
      if (Number(product.stock) < qty) {
        return NextResponse.json({ error: 'สินค้าในคลังไม่เพียงพอ' }, { status: 400 });
      }
      for (let i = 0; i < qty; i++) {
        purchasedCodes.push(generateProductCode(product.subcategory));
      }
    }

    // ดึงข้อมูลค่าตั้งค่าแคมเปญแต้มคูณสอง (X2)
    const { data: x2Setting } = await supabaseAdmin
      .from('global_settings')
      .select('value')
      .eq('key', 'double_points_event')
      .maybeSingle();
    const isX2Active = x2Setting?.value === true || x2Setting?.value === 'true';

    // คำนวณแต้มสะสมจากการสั่งซื้อ
    let multiplier = 1.0;
    if (userRank.name === 'Bronze VIP') multiplier = 1.1;
    else if (userRank.name === 'Silver VIP') multiplier = 1.2;
    else if (userRank.name === 'Gold VIP') multiplier = 1.3;
    else if (userRank.name === 'Platinum VIP') multiplier = 1.5;

    const basePoints = Math.floor(finalPrice / 10); // 1 แต้มทุกๆ 10 บาท
    let pointsEarned = Math.floor(basePoints * multiplier);
    if (isX2Active) {
      pointsEarned = pointsEarned * 2;
    }

    const nextBalance = Number(user.balance) - finalPrice;
    const nextTotalSpent = (Number(user.total_spent) || 0) + finalPrice;

    // ตรวจสอบยศใหม่หลังใช้จ่ายสะสมเพิ่มขึ้น
    const userRankAfter = getUserRank(nextTotalSpent);
    const RANKS_NAMES = ['Member', 'Bronze VIP', 'Silver VIP', 'Gold VIP', 'Platinum VIP'];
    const oldRankIdx = RANKS_NAMES.indexOf(userRank.name);
    const newRankIdx = RANKS_NAMES.indexOf(userRankAfter.name);
    const lastRewardedRankIdx = RANKS_NAMES.indexOf(user.last_rewarded_rank || 'Member');

    let finalBalanceAfterRewards = nextBalance;
    let userPoints = Number(user.points) || 0;
    let finalPointsAfterRewards = userPoints + pointsEarned;
    let nextLastRewardedRank = user.last_rewarded_rank || 'Member';
    let rankUpInfo = null;

    if (newRankIdx > lastRewardedRankIdx) {
      let promoCreditReward = 0;
      let promoPointReward = 0;
      for (let i = lastRewardedRankIdx + 1; i <= newRankIdx; i++) {
        const rName = RANKS_NAMES[i];
        if (rName === 'Bronze VIP') { promoCreditReward += 50; promoPointReward += 100; }
        else if (rName === 'Silver VIP') { promoCreditReward += 150; promoPointReward += 300; }
        else if (rName === 'Gold VIP') { promoCreditReward += 500; promoPointReward += 1000; }
        else if (rName === 'Platinum VIP') { promoCreditReward += 1500; promoPointReward += 3000; }
      }

      if (promoCreditReward > 0 || promoPointReward > 0) {
        finalBalanceAfterRewards += promoCreditReward;
        finalPointsAfterRewards += promoPointReward;
        nextLastRewardedRank = userRankAfter.name;
        rankUpInfo = {
          from: user.last_rewarded_rank || 'Member',
          to: userRankAfter.name,
          creditReward: promoCreditReward,
          pointReward: promoPointReward
        };

        // บันทึกธุรกรรมโบนัสเครดิตเลื่อนยศ
        if (promoCreditReward > 0) {
          await supabaseAdmin
            .from('transactions')
            .insert([
              {
                user_id: user.id,
                type: 'adjust',
                amount: promoCreditReward,
                description: `รางวัลเลื่อนยศสมาชิกเป็น ${userRankAfter.name} 🎉 (+${promoCreditReward} THB)`,
                status: 'completed'
              }
            ]);
        }

        // บันทึกธุรกรรมโบนัสพอยท์เลื่อนยศ
        if (promoPointReward > 0) {
          await supabaseAdmin
            .from('point_transactions')
            .insert([
              {
                user_id: user.id,
                type: 'earn',
                amount: promoPointReward,
                description: `โบนัสแต้มสะสมจากการเลื่อนยศเป็น ${userRankAfter.name} 🎉`
              }
            ]);
        }
      }
    }

    // อัปเดตข้อมูลผู้ใช้งาน (หักเงิน, เพิ่มสะสมยอดซื้อ, เพิ่มพอยท์, เซฟยศรางวัลเคลม)
    const { error: userUpdateErr } = await supabaseAdmin
      .from('users')
      .update({
        balance: finalBalanceAfterRewards,
        total_spent: nextTotalSpent,
        points: finalPointsAfterRewards,
        last_rewarded_rank: nextLastRewardedRank
      })
      .eq('id', user.id);

    if (userUpdateErr) throw userUpdateErr;

    // อัปเดตสต็อก/ยอดขายสินค้า
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

    // บันทึกรายละเอียดส่วนลดในคำอธิบาย
    const rankDesc = rankDiscountPercent > 0 ? ` (ส่วนลด VIP Rank [${userRank.badge} ${rankDiscountPercent}%] -${rankDiscountAmount} บาท)` : '';
    const couponDesc = couponUsed ? ` (ใช้คูปอง ${couponUsed.code} ลด ${couponDiscountAmount} บาท)` : '';
    const codesStr = purchasedCodes.join('\n');
    const description = `ซื้อสินค้า: ${product.name} x${qty}${rankDesc}${couponDesc}\n${codesStr}`;

    // บันทึก Transaction การซื้อสินค้า
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

    // บันทึกแต้มสะสมที่ได้จากการซื้อ
    if (pointsEarned > 0) {
      await supabaseAdmin
        .from('point_transactions')
        .insert([
          {
            user_id: user.id,
            type: 'earn',
            amount: pointsEarned,
            description: `ได้รับแต้มจากการซื้อสินค้า: ${product.name} x${qty} (คูณยศ: ${multiplier}x${isX2Active ? ' x2 กิจกรรม' : ''})`
          }
        ]);
    }

    // บันทึกความคืบหน้าเควสซื้อของรายวัน (Daily Purchase Quest)
    try {
      const todayStr = new Date().toLocaleDateString('en-CA'); // รูปแบบ YYYY-MM-DD ตาม timezone ท้องถิ่น
      await supabaseAdmin
        .from('user_quests')
        .insert([
          {
            user_id: user.id,
            quest_type: 'daily_purchase',
            completed_date: todayStr,
            is_claimed: false
          }
        ]);
    } catch (questErr) {
      // ข้ามกรณีทำเควสซ้ำในวันเดียวกัน
    }

    // อัปเดตคีย์โค้ดว่าถูกใช้งานแล้ว
    if (product.stock_type === 'code') {
      const codeIds = codesInDb.map(c => c.id);
      const { error: codeUpdateErr } = await supabaseAdmin
        .from('product_codes')
        .update({ is_used: true })
        .in('id', codeIds);

      if (codeUpdateErr) throw codeUpdateErr;
    }

    await notifyPurchase({
      username: user.username || user.email,
      productName: product.name,
      amount: finalPrice,
    });

    const updatedStock = product.stock_type === 'manual'
      ? Number(product.stock) - qty
      : undefined;
    await checkAndNotifyLowStock(product, updatedStock);

    return NextResponse.json({
      message: 'ซื้อสินค้าสำเร็จแล้ว!',
      newBalance: finalBalanceAfterRewards,
      newTotalSpent: nextTotalSpent,
      newPoints: finalPointsAfterRewards,
      transaction,
      receivedCodes: purchasedCodes,
      rankUpInfo,
    });
  } catch (error) {
    console.error('Purchase error:', error);
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในระบบระเบียบคำสั่งซื้อ' }, { status: 500 });
  }
}
