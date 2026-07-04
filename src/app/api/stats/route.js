import { supabaseAdmin } from '@/lib/supabase';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    // ดึงสถิติต่างๆ แบบขนาน
    const [
      { count: totalUsers, error: userCountErr },
      { data: products, count: totalProducts, error: prodErr },
      { count: unusedCodesCount, error: codesErr },
      { data: purchaseTransactions, error: purchaseErr },
      { data: topupTransactions, error: topupErr },
      { count: pendingTicketsCount, error: ticketsErr },
      { data: topProducts, error: topProdErr },
      { count: totalTxCount, error: txCountErr },
      { count: activeCouponsCount, error: couponsCountErr },
      { count: totalSpinsCount, error: spinsCountErr },
      { data: recentTxs, error: recentTxsErr },
      { data: chartTxs, error: chartTxsErr }
    ] = await Promise.all([
      supabaseAdmin.from('users').select('*', { count: 'exact', head: true }),
      supabaseAdmin.from('products').select('stock, stock_type, sold', { count: 'exact' }),
      supabaseAdmin.from('product_codes').select('*', { count: 'exact', head: true }).eq('is_used', false),
      supabaseAdmin.from('transactions').select('amount').eq('type', 'purchase'),
      supabaseAdmin.from('transactions').select('amount').eq('type', 'topup'),
      supabaseAdmin.from('support_tickets').select('*', { count: 'exact', head: true }).eq('status', 'open'),
      supabaseAdmin.from('products').select('id, name, price, sold, image').order('sold', { ascending: false }).limit(5),
      supabaseAdmin.from('transactions').select('*', { count: 'exact', head: true }),
      supabaseAdmin.from('coupons').select('*', { count: 'exact', head: true }).eq('is_active', true),
      supabaseAdmin.from('gacha_logs').select('*', { count: 'exact', head: true }),
      supabaseAdmin.from('transactions').select(`
        id,
        type,
        amount,
        description,
        created_at,
        users:user_id (username)
      `).order('created_at', { ascending: false }).limit(5),
      supabaseAdmin.from('transactions').select('type, amount, created_at').gte('created_at', sevenDaysAgo.toISOString())
    ]);

    if (userCountErr) throw userCountErr;
    if (prodErr) throw prodErr;
    if (codesErr) throw codesErr;
    if (purchaseErr) throw purchaseErr;
    if (topupErr) throw topupErr;
    if (ticketsErr) throw ticketsErr;
    if (topProdErr) throw topProdErr;
    if (txCountErr) throw txCountErr;
    if (couponsCountErr) throw couponsCountErr;
    if (spinsCountErr) throw spinsCountErr;
    if (recentTxsErr) throw recentTxsErr;
    if (chartTxsErr) throw chartTxsErr;

    let totalStock = 0;
    let totalSold = 0;

    if (products) {
      products.forEach(p => {
        if (p.stock_type === 'manual') {
          totalStock += Math.max(0, Number(p.stock) || 0);
        }
        totalSold += Math.max(0, Number(p.sold) || 0);
      });
    }

    // บวกจำนวนรหัสโค้ดที่พร้อมจำหน่ายในระบบ
    totalStock += (unusedCodesCount || 0);

    // คำนวณรายได้และยอดเติมเงินสะสม
    const totalRevenue = purchaseTransactions ? purchaseTransactions.reduce((sum, t) => sum + Math.abs(Number(t.amount) || 0), 0) : 0;
    const totalTopups = topupTransactions ? topupTransactions.reduce((sum, t) => sum + (Number(t.amount) || 0), 0) : 0;

    // จัดรูปแบบประวัติธุรกรรมล่าสุด
    const formattedRecentTxs = recentTxs ? recentTxs.map(t => ({
      id: t.id,
      type: t.type,
      amount: Number(t.amount),
      description: t.description,
      createdAt: t.created_at,
      username: t.users ? t.users.username : 'ระบบ'
    })) : [];

    // สร้างข้อมูลรายวันย้อนหลัง 7 วันสำหรับทำกราฟ
    const dailyStats = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateString = d.toLocaleDateString('th-TH', { month: 'short', day: 'numeric' });
      const dateISO = d.toISOString().split('T')[0];
      dailyStats.push({
        date: dateString,
        isoDate: dateISO,
        sales: 0,
        topups: 0
      });
    }

    if (chartTxs) {
      chartTxs.forEach(tx => {
        if (!tx.created_at) return;
        const txDate = tx.created_at.split('T')[0];
        const dayStat = dailyStats.find(ds => ds.isoDate === txDate);
        if (dayStat) {
          if (tx.type === 'purchase') {
            dayStat.sales += Math.abs(Number(tx.amount) || 0);
          } else if (tx.type === 'topup') {
            dayStat.topups += Number(tx.amount) || 0;
          }
        }
      });
    }

    return NextResponse.json(
      {
        users: totalUsers ?? 0,
        products: totalProducts ?? 0,
        stock: totalStock,
        sold: totalSold,
        totalRevenue,
        totalTopups,
        pendingTickets: pendingTicketsCount ?? 0,
        topProducts: topProducts ?? [],
        totalTransactions: totalTxCount ?? 0,
        activeCoupons: activeCouponsCount ?? 0,
        totalGachaSpins: totalSpinsCount ?? 0,
        recentTransactions: formattedRecentTxs,
        dailyStats
      },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error) {
    console.error('Stats fetch error:', error);
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการดึงสถิติ' }, { status: 500 });
  }
}


