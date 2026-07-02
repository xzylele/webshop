import { supabaseAdmin } from '@/lib/supabase';
import { NextResponse } from 'next/server';

const initialProducts = [
  // 1. บัตรเติมเกม (Garena Shells - สต็อกแมนนวล)
  {
    name: 'Garena Shells 450 Shells',
    description: 'บัตรเติมเกมในเครือ Garena เช่น RoV, Free Fire, League of Legends, FC Mobile (กำหนดสต็อกเอง)',
    price: 299,
    image: 'https://images.unsplash.com/photo-1612287230202-1bf1d85d1bdf?w=500&auto=format&fit=crop&q=60',
    category: 'Game Card',
    subcategory: 'บัตรเติมเกม',
    stock: 100,
    sold: 45,
    stockType: 'manual'
  },
  // 2. บัตรเติมเกม (Razer Gold - สต็อกแมนนวล)
  {
    name: 'Razer Gold PIN 300 THB',
    description: 'บัตรเติมเงิน Razer Gold สำหรับเติมเกมยอดนิยมมากมาย เช่น Genshin Impact, PUBG Mobile, Ragnarok X (กำหนดสต็อกเอง)',
    price: 300,
    image: 'https://images.unsplash.com/photo-1538481199705-c710c4e965fc?w=500&auto=format&fit=crop&q=60',
    category: 'Game Card',
    subcategory: 'บัตรเติมเกม',
    stock: 75,
    sold: 190,
    stockType: 'manual'
  },
  // 3. บัตรเติมเกม (Roblox - สต็อกตามโค้ดจริง 5 โค้ด)
  {
    name: 'Roblox Gift Card 800 Robux (10 USD)',
    description: 'บัตรของขวัญ Roblox สำหรับรับ 800 Robux เข้าสู่บัญชีของคุณโดยตรงเพื่อแลกซื้อของแต่งตัวและไอเทมในเกม (สต็อกตามรหัสโค้ดจริง)',
    price: 380,
    image: 'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=500&auto=format&fit=crop&q=60',
    category: 'Game Card',
    subcategory: 'บัตรเติมเกม',
    stock: 0,
    sold: 310,
    stockType: 'code'
  },
  // 4. Steam Wallet (Steam 200 - สต็อกตามโค้ดจริง 5 โค้ด)
  {
    name: 'Steam Wallet Code 200 THB',
    description: 'รหัสเติมเงิน Steam Wallet มูลค่า 200 บาทสำหรับซื้อเกม ไอเทม และซอฟต์แวร์บน Steam ประเทศไทย (สต็อกตามรหัสโค้ดจริง)',
    price: 215,
    image: 'https://images.unsplash.com/photo-1580234810907-b40315b76418?w=500&auto=format&fit=crop&q=60',
    category: 'Steam Wallet',
    subcategory: 'Steam Wallet',
    stock: 0,
    sold: 340,
    stockType: 'code'
  },
  // 5. Steam Wallet (Steam 1000 - สต็อกตามโค้ดจริง 5 โค้ด)
  {
    name: 'Steam Wallet Code 1,000 THB',
    description: 'รหัสเติมเงิน Steam Wallet มูลค่า 1,000 บาท เติมเข้าบัญชีสตีมได้ทันที ปลอดภัย 100% (สต็อกตามรหัสโค้ดจริง)',
    price: 1045,
    image: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=500&auto=format&fit=crop&q=60',
    category: 'Steam Wallet',
    subcategory: 'Steam Wallet',
    stock: 0,
    sold: 156,
    stockType: 'code'
  },
  // 6. Netflix (Netflix Premium - สต็อกตามโค้ดจริง 5 ไอดี)
  {
    name: 'Netflix Premium 30 วัน (แชร์จอ 4K)',
    description: 'บัญชีแชร์สำหรับรับชม Netflix แพ็กเกจพรีเมียมความละเอียด Ultra HD 4K (จำนวน 1 จอภาพ) รับประกันเต็มเวลา 30 วัน (สต็อกตามไอดี/รหัสจริง)',
    price: 139,
    image: 'https://images.unsplash.com/photo-1574375927938-d5a98e8fed85?w=500&auto=format&fit=crop&q=60',
    category: 'Streaming',
    subcategory: 'Netflix',
    stock: 0,
    sold: 840,
    stockType: 'code'
  },
  // 7. Disney+ (Disney - สต็อกตามโค้ดจริง 5 ไอดี)
  {
    name: 'Disney+ Hotstar 30 วัน (แชร์จอ)',
    description: 'แพ็กเกจแชร์ดู Disney+ Hotstar ความละเอียดสูงสุด 4K รองรับบรรยายไทยและพากย์ไทย รับประกันเต็มเวลา 30 วัน (สต็อกตามไอดี/รหัสจริง)',
    price: 89,
    image: 'https://images.unsplash.com/photo-1522869635100-9f4c5e86aa37?w=500&auto=format&fit=crop&q=60',
    category: 'Streaming',
    subcategory: 'Disneyplus',
    stock: 0,
    sold: 520,
    stockType: 'code'
  },
  // 8. Spotify (Spotify 30 วัน - สต็อกตามโค้ดจริง 5 โค้ด)
  {
    name: 'Spotify Premium 30 วัน (ส่งคำเชิญเข้าร่วมครอบครัว)',
    description: 'อัปเกรดบัญชี Spotify ของคุณเป็นพรีเมียมด้วยลิงก์เชิญแบบครอบครัว ฟังเพลงออฟไลน์ ไม่มีโฆษณาคั่น คุณภาพเสียงสูงสุด (สต็อกตามรหัสโค้ดจริง)',
    price: 49,
    image: 'https://images.unsplash.com/photo-1614680376593-902f74fa0d41?w=500&auto=format&fit=crop&q=60',
    category: 'Streaming',
    subcategory: 'Spotify',
    stock: 0,
    sold: 990,
    stockType: 'code'
  }
];

const initialGachaItems = [
  {
    name: 'บัตร Steam Wallet 200 THB',
    type: 'code',
    chance: 10,
    stock: [
      'STEAM-GAC-SEED-1-AAAA',
      'STEAM-GAC-SEED-2-BBBB',
      'STEAM-GAC-SEED-3-CCCC',
      'STEAM-GAC-SEED-4-DDDD',
      'STEAM-GAC-SEED-5-EEEE'
    ]
  },
  {
    name: 'เกลือ (ขอบคุณที่ร่วมสนุกจ้า)',
    type: 'empty',
    chance: 40
  },
  {
    name: 'คูปองส่วนลด 20 บาท',
    type: 'coupon',
    chance: 25,
    couponDiscount: 20
  },
  {
    name: 'คูปองส่วนลด 50 บาท',
    type: 'coupon',
    chance: 15,
    couponDiscount: 50
  },
  {
    name: 'เกลือ (โชคดีครั้งหน้านะครับ)',
    type: 'empty',
    chance: 35
  },
  {
    name: 'Spotify Premium 30 วัน',
    type: 'code',
    chance: 20,
    stock: [
      'SPOTIFY-GAC-1-INVITE-XXXX',
      'SPOTIFY-GAC-2-INVITE-YYYY',
      'SPOTIFY-GAC-3-INVITE-ZZZZ',
      'SPOTIFY-GAC-4-INVITE-WWWW'
    ]
  },
  {
    name: 'คูปองส่วนลด 100 บาท',
    type: 'coupon',
    chance: 5,
    couponDiscount: 100
  },
  {
    name: 'ไอดี Netflix Premium 30 วัน',
    type: 'code',
    chance: 8,
    stock: [
      'Email: netflix_gacha_1@nakata.com | Pass: 1234gacha',
      'Email: netflix_gacha_2@nakata.com | Pass: 5678gacha',
      'Email: netflix_gacha_3@nakata.com | Pass: 9999gacha'
    ]
  }
];

export async function GET() {
  try {
    const allZeroUUID = '00000000-0000-0000-0000-000000000000';

    // 0. ดึงธุรกรรมการซื้อที่สำเร็จเพื่อคำนวณยอดขายสะสมจริง
    const { data: txs, error: txsErr } = await supabaseAdmin
      .from('transactions')
      .select('description')
      .eq('type', 'purchase')
      .eq('status', 'completed');

    const soldMap = {};
    if (!txsErr && txs) {
      txs.forEach(t => {
        if (!t.description) return;
        const match = t.description.match(/ซื้อสินค้า:\s*(.+?)\s*x(\d+)/);
        if (match) {
          const prodName = match[1].trim();
          const qty = parseInt(match[2], 10) || 0;
          soldMap[prodName] = (soldMap[prodName] || 0) + qty;
        }
      });
    }

    // 1. ลบข้อมูลเก่าทั้งหมดตามความสัมพันธ์ของ Foreign Key
    await supabaseAdmin.from('gacha_won_codes').delete().neq('id', allZeroUUID);
    await supabaseAdmin.from('gacha_logs').delete().neq('id', allZeroUUID);
    await supabaseAdmin.from('gacha_items').delete().neq('id', allZeroUUID);
    await supabaseAdmin.from('product_codes').delete().neq('id', allZeroUUID);
    await supabaseAdmin.from('products').delete().neq('id', allZeroUUID);

    // 2. ใส่ข้อมูลสินค้าตัวอย่าง
    const seededProducts = [];
    for (const p of initialProducts) {
      const realSold = soldMap[p.name] || 0;
      const finalStock = p.stockType === 'manual' ? Math.max(0, (p.stock || 0) - realSold) : 0;

      const { data: created, error } = await supabaseAdmin
        .from('products')
        .insert([
          {
            name: p.name,
            description: p.description,
            price: p.price,
            image: p.image,
            category: p.category,
            subcategory: p.subcategory,
            stock: finalStock,
            stock_type: p.stockType,
            sold: realSold
          }
        ])
        .select('*')
        .single();

      if (error) throw error;
      seededProducts.push(created);

      if (created.stock_type === 'code') {
        const codes = [];
        for (let i = 1; i <= 5; i++) {
          let codeVal = '';
          if (['Netflix', 'Disneyplus', 'Spotify'].includes(created.subcategory)) {
            codeVal = `Email: customer_seed_${i}_${created.subcategory.toLowerCase()}@nakata.com | Password: pass${Math.random().toString(36).substr(2, 4)}`;
          } else if (created.subcategory === 'Steam Wallet') {
            codeVal = `STEAM-VAL-${i}-${Math.random().toString(36).substr(2, 4).toUpperCase()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;
          } else {
            codeVal = `ROBLOX-PIN-${i}-${Math.random().toString(36).substr(2, 4).toUpperCase()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;
          }
          codes.push({
            product_id: created.id,
            code: codeVal,
            is_used: false
          });
        }
        const { error: codesError } = await supabaseAdmin
          .from('product_codes')
          .insert(codes);

        if (codesError) throw codesError;
      }
    }

    // 3. ใส่ข้อมูลของรางวัลวงล้อ Gacha เริ่มต้น
    const formattedGachaItems = initialGachaItems.map(item => ({
      name: item.name,
      type: item.type,
      chance: item.chance,
      coupon_discount: item.couponDiscount || 0,
      stock: item.stock || []
    }));

    const { error: gachaErr } = await supabaseAdmin
      .from('gacha_items')
      .insert(formattedGachaItems);

    if (gachaErr) throw gachaErr;

    // 4. ใส่ข้อมูลผู้โชคดีตัวอย่างใน gacha_logs
    const { error: logErr } = await supabaseAdmin
      .from('gacha_logs')
      .insert([
        { username: 'customer@nakatashop.com', prize_name: 'คูปองส่วนลด 20 บาท' },
        { username: 'samut_nakatadev', prize_name: 'บัตร Steam Wallet 200 THB' },
        { username: 'winner_gamer99', prize_name: 'คูปองส่วนลด 50 บาท' }
      ]);

    if (logErr) throw logErr;

    return NextResponse.json({
      message: 'รีเซ็ตข้อมูลร้านค้าและเพิ่มสินค้า Mockup พร้อมของรางวัลวงล้อ Gacha และตารางผู้โชคดีตัวอย่างใน Supabase เรียบร้อยแล้ว!',
      productsCount: seededProducts.length,
      gachaItemsCount: initialGachaItems.length
    });
  } catch (error) {
    console.error('Seed error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

