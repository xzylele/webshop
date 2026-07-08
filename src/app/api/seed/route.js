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

const initialGachaTiers = [
  { name: 'ธรรมดา', slug: 'normal', price: 30, sort_order: 10 },
  { name: 'พรีเมียม', slug: 'premium', price: 100, sort_order: 20 },
  { name: 'ลักชูรี่', slug: 'luxury', price: 300, sort_order: 30 }
];

const initialGachaItems = [
  {
    name: 'บัตร Steam Wallet 200 THB',
    type: 'code',
    tierSlug: 'normal',
    chance: 10,
    stock: [
      'STEAM-NW-30-200-A1B2-C3D4',
      'STEAM-NW-30-200-E5F6-G7H8',
      'STEAM-NW-30-200-I9J0-K1L2',
      'STEAM-NW-30-200-M3N4-O5P6',
      'STEAM-NW-30-200-Q7R8-S9T0',
      'STEAM-NW-30-200-U1V2-W3X4',
      'STEAM-NW-30-200-Y5Z6-A7B8',
      'STEAM-NW-30-200-C9D0-E1F2',
      'STEAM-NW-30-200-G3H4-I5J6',
      'STEAM-NW-30-200-K7L8-M9N0',
      'STEAM-NW-30-200-O1P2-Q3R4',
      'STEAM-NW-30-200-S5T6-U7V8'
    ]
  },
  {
    name: 'เกลือ (ขอบคุณที่ร่วมสนุกจ้า)',
    type: 'empty',
    tierSlug: 'normal',
    chance: 50
  },
  {
    name: 'คูปองส่วนลด 20 บาท',
    type: 'coupon',
    tierSlug: 'normal',
    chance: 25,
    couponDiscount: 20
  },
  {
    name: 'คูปองส่วนลด 50 บาท',
    type: 'coupon',
    tierSlug: 'normal',
    chance: 15,
    couponDiscount: 50
  },
  {
    name: 'เกลือ (โชคดีครั้งหน้านะครับ)',
    type: 'empty',
    tierSlug: 'premium',
    chance: 70
  },
  {
    name: 'Spotify Premium 30 วัน',
    type: 'code',
    tierSlug: 'premium',
    chance: 30,
    stock: [
      'SP-FAMILY-INV-30D-AA11-BB22',
      'SP-FAMILY-INV-30D-CC33-DD44',
      'SP-FAMILY-INV-30D-EE55-FF66',
      'SP-FAMILY-INV-30D-GG77-HH88',
      'SP-FAMILY-INV-30D-II99-JJ00',
      'SP-FAMILY-INV-30D-KK11-LL22',
      'SP-FAMILY-INV-30D-MM33-NN44',
      'SP-FAMILY-INV-30D-OO55-PP66',
      'SP-FAMILY-INV-30D-QQ77-RR88',
      'SP-FAMILY-INV-30D-SS99-TT00',
      'SP-FAMILY-INV-30D-UU11-VV22',
      'SP-FAMILY-INV-30D-WW33-XX44'
    ]
  },
  {
    name: 'คูปองส่วนลด 100 บาท',
    type: 'coupon',
    tierSlug: 'luxury',
    chance: 60,
    couponDiscount: 100
  },
  {
    name: 'ไอดี Netflix Premium 30 วัน',
    type: 'code',
    tierSlug: 'luxury',
    chance: 40,
    stock: [
      'Email: netflix_gacha_val01@nakatashop.com | Pass: NkGach123!',
      'Email: netflix_gacha_val02@nakatashop.com | Pass: NkGach456!',
      'Email: netflix_gacha_val03@nakatashop.com | Pass: NkGach789!',
      'Email: netflix_gacha_val04@nakatashop.com | Pass: NkGachabc!',
      'Email: netflix_gacha_val05@nakatashop.com | Pass: NkGachdef!',
      'Email: netflix_gacha_val06@nakatashop.com | Pass: NkGachghi!',
      'Email: netflix_gacha_val07@nakatashop.com | Pass: NkGachjkl!',
      'Email: netflix_gacha_val08@nakatashop.com | Pass: NkGachmno!',
      'Email: netflix_gacha_val09@nakatashop.com | Pass: NkGachpqr!',
      'Email: netflix_gacha_val10@nakatashop.com | Pass: NkGachstu!',
      'Email: netflix_gacha_val11@nakatashop.com | Pass: NkGachvwx!',
      'Email: netflix_gacha_val12@nakatashop.com | Pass: NkGachyza!'
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
    await supabaseAdmin.from('gacha_tiers').delete().neq('id', allZeroUUID);
    await supabaseAdmin.from('product_codes').delete().neq('id', allZeroUUID);
    await supabaseAdmin.from('products').delete().neq('id', allZeroUUID);
    await supabaseAdmin.from('site_settings').delete().neq('key', 'none');

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
    const { data: seededTiers, error: tierError } = await supabaseAdmin
      .from('gacha_tiers').insert(initialGachaTiers).select('*');
    if (tierError) throw tierError;
    const tierIds = Object.fromEntries(seededTiers.map(tier => [tier.slug, tier.id]));

    const formattedGachaItems = initialGachaItems.map(item => ({
      tier_id: tierIds[item.tierSlug],
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

    // 5. ใส่ข้อมูลตั้งค่าเริ่มต้นระบบเติมเงินใน site_settings
    const { error: settingsErr } = await supabaseAdmin
      .from('site_settings')
      .insert([
        {
          key: 'topup_config',
          value: {
            promptpay: {
              enabled: true,
              promptpayId: '004999038911094',
              expectedName: 'สมัชญ์'
            },
            wallet: {
              enabled: true
            },
            cashcard: {
              enabled: true,
              feePercent: 15
            },
            giftcode: {
              enabled: true
            }
          }
        }
      ]);

    if (settingsErr) throw settingsErr;

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

