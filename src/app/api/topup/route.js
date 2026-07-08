import { supabaseAdmin } from '@/lib/supabase';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]/route';
import { NextResponse } from 'next/server';
import { notifyTopup } from '@/lib/adminNotifications';

export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบก่อนทำรายการ' }, { status: 401 });
    }

    const { amount, method, refCode, base64 } = await request.json();

    // Fetch topup configuration from database
    let config = {
      promptpay: { enabled: true, promptpayId: '004999038911094', expectedName: 'สมัชญ์' },
      wallet: { enabled: true },
      cashcard: { enabled: true, feePercent: 15 },
      giftcode: { enabled: true }
    };

    try {
      const { data: dbConfig } = await supabaseAdmin
        .from('site_settings')
        .select('value')
        .eq('key', 'topup_config')
        .maybeSingle();

      if (dbConfig && dbConfig.value) {
        config = dbConfig.value;
      }
    } catch (err) {
      console.error('Failed to load topup config, using defaults:', err);
    }

    if (method === 'giftcode') {
      if (!config.giftcode?.enabled) {
        return NextResponse.json({ error: 'ช่องทาง Gacha Code ปิดปรับปรุงชั่วคราว' }, { status: 400 });
      }
      if (!refCode || typeof refCode !== 'string') {
        return NextResponse.json({ error: 'กรุณากรอกรหัสเติมเงิน' }, { status: 400 });
      }

      // 1. ค้นหารหัสเติมเงินในตาราง topup_codes
      const { data: codeRecord, error: codeErr } = await supabaseAdmin
        .from('topup_codes')
        .select('*')
        .eq('code', refCode.trim().toUpperCase())
        .eq('is_used', false)
        .maybeSingle();

      if (codeErr) throw codeErr;
      if (!codeRecord) {
        return NextResponse.json({ error: 'รหัสเติมเงินไม่ถูกต้อง หรือถูกใช้งานไปแล้ว' }, { status: 400 });
      }

      // 2. ดึงข้อมูลผู้ใช้เพื่อคำนวณ balance ใหม่
      const { data: user, error: userErr } = await supabaseAdmin
        .from('users')
        .select('*')
        .eq('id', session.user.id)
        .maybeSingle();

      if (userErr) throw userErr;
      if (!user) {
        return NextResponse.json({ error: 'ไม่พบข้อมูลผู้ใช้งาน' }, { status: 404 });
      }

      const topupAmount = Number(codeRecord.amount);
      const nextBalance = Number(user.balance) + topupAmount;

      // 3. ปรับปรุงสถานะรหัสเติมเงินเป็นใช้งานแล้ว (พร้อมระบุตัวผู้ใช้และวันเวลาที่ใช้)
      const { error: updateCodeErr } = await supabaseAdmin
        .from('topup_codes')
        .update({
          is_used: true,
          used_by: user.id,
          used_at: new Date().toISOString(),
        })
        .eq('id', codeRecord.id);

      if (updateCodeErr) throw updateCodeErr;

      // 4. เพิ่มเงินเข้าบัญชีผู้ใช้
      const { error: updateErr } = await supabaseAdmin
        .from('users')
        .update({ balance: nextBalance })
        .eq('id', user.id);

      if (updateErr) throw updateErr;

      // 5. บันทึกประวัติการทำรายการ
      const { error: txErr } = await supabaseAdmin
        .from('transactions')
        .insert([
          {
            user_id: user.id,
            type: 'topup',
            amount: topupAmount,
            description: `แลกโค้ดรางวัล Gacha: ${refCode.trim().toUpperCase()}`,
            status: 'completed',
          }
        ]);

      if (txErr) throw txErr;

      // แจ้งเตือนแอดมิน
      await notifyTopup({
        username: user.username || user.email,
        amount: topupAmount,
        method: 'Gacha Gift Code',
      });

      return NextResponse.json({
        message: 'เติมเงินผ่านโค้ดรางวัลสำเร็จแล้ว!',
        newBalance: nextBalance,
      });
    }

    // Fetch user details for checking balance and updating
    const { data: user, error: userErr } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('id', session.user.id)
      .maybeSingle();

    if (userErr) throw userErr;
    if (!user) {
      return NextResponse.json({ error: 'ไม่พบข้อมูลผู้ใช้งาน' }, { status: 404 });
    }

    if (method === 'PromptPay QR') {
      if (!config.promptpay?.enabled) {
        return NextResponse.json({ error: 'ช่องทาง PromptPay QR ปิดปรับปรุงชั่วคราว' }, { status: 400 });
      }
      if (!base64) {
        return NextResponse.json({ error: 'กรุณาอัปโหลดรูปภาพสลิปโอนเงิน' }, { status: 400 });
      }

      const apiKey = process.env.EASYSLIP_API_KEY;
      if (!apiKey || apiKey === 'your_easyslip_api_key_here') {
        console.warn('EasySlip API key not configured. Processing mock verification.');
        
        const creditAmount = Number(amount);
        if (!creditAmount || creditAmount <= 0) {
          return NextResponse.json({ error: 'กรุณาระบุจำนวนเงินที่ถูกต้อง' }, { status: 400 });
        }

        const mockTransRef = 'MOCK-' + Math.random().toString(36).substr(2, 9).toUpperCase();
        const nextBalance = Number(user.balance) + creditAmount;

        const { error: updateErr } = await supabaseAdmin
          .from('users')
          .update({ balance: nextBalance })
          .eq('id', user.id);

        if (updateErr) throw updateErr;

        const { error: txErr } = await supabaseAdmin
          .from('transactions')
          .insert([
            {
              user_id: user.id,
              type: 'topup',
              amount: creditAmount,
              description: `เติมเงินจำลองผ่าน PromptPay อ้างอิง: ${mockTransRef}`,
              status: 'completed',
            }
          ]);

        if (txErr) throw txErr;

        await notifyTopup({
          username: user.username || user.email,
          amount: creditAmount,
          method: 'PromptPay QR (Mock)',
        });

        return NextResponse.json({
          message: `[โหมดทดลอง] เติมเงินจำลองสำเร็จแล้ว! ได้รับเงินจำนวน ${creditAmount.toLocaleString()} บาท`,
          newBalance: nextBalance,
        });
      }

      // Real EasySlip API Call
      try {
        const apiResponse = await fetch('https://api.easyslip.com/v2/verify/bank', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            base64: base64,
            checkDuplicate: true,
          }),
        });

        const verifyData = await apiResponse.json();

        if (!verifyData.success) {
          return NextResponse.json({
            error: verifyData.error?.message || 'ไม่สามารถตรวจสอบสลิปได้ สลิปอาจไม่ถูกต้องหรือหมดอายุ'
          }, { status: 400 });
        }

        const slipData = verifyData.data;
        const transRef = slipData.rawSlip?.transRef;
        const amountInSlip = Number(slipData.rawSlip?.amount?.amount || slipData.amountInSlip);
        const receiverName = slipData.rawSlip?.receiver?.account?.name?.th || '';

        if (!transRef) {
          return NextResponse.json({ error: 'ไม่พบเลขอ้างอิงธนาคารบนสลิป' }, { status: 400 });
        }

        // Check for duplicate slip in database
        const { data: duplicateTx, error: dupError } = await supabaseAdmin
          .from('transactions')
          .select('id')
          .like('description', `%${transRef}%`)
          .maybeSingle();

        if (dupError) throw dupError;
        if (duplicateTx) {
          return NextResponse.json({ error: 'สลิปนี้ถูกใช้งานไปแล้ว' }, { status: 400 });
        }

        // Verify receiver name if configured
        const expectedReceiver = config.promptpay?.expectedName || process.env.EXPECTED_RECEIVER_NAME;
        if (expectedReceiver && expectedReceiver.trim() !== '') {
          const normalizedExpected = expectedReceiver.trim().toLowerCase();
          const normalizedReceiver = receiverName.trim().toLowerCase();
          if (!normalizedReceiver.includes(normalizedExpected)) {
            return NextResponse.json({
              error: `ชื่อบัญชีผู้รับเงินไม่ถูกต้อง (สลิปนี้โอนให้คุณ ${receiverName || 'คนอื่น'})`
            }, { status: 400 });
          }
        }

        if (isNaN(amountInSlip) || amountInSlip <= 0) {
          return NextResponse.json({ error: 'ยอดเงินในสลิปไม่ถูกต้อง' }, { status: 400 });
        }

        const nextBalance = Number(user.balance) + amountInSlip;

        // Update user balance
        const { error: updateErr } = await supabaseAdmin
          .from('users')
          .update({ balance: nextBalance })
          .eq('id', user.id);

        if (updateErr) throw updateErr;

        // Insert transaction log
        const { error: txErr } = await supabaseAdmin
          .from('transactions')
          .insert([
            {
              user_id: user.id,
              type: 'topup',
              amount: amountInSlip,
              description: `เติมเงินผ่าน PromptPay (EasySlip) อ้างอิง: ${transRef}`,
              status: 'completed',
            }
          ]);

        if (txErr) throw txErr;

        // Notify admin
        await notifyTopup({
          username: user.username || user.email,
          amount: amountInSlip,
          method: 'PromptPay QR (EasySlip)',
        });

        return NextResponse.json({
          message: `เติมเงินสำเร็จแล้ว! ได้รับเงินจำนวน ${amountInSlip.toLocaleString()} บาท`,
          newBalance: nextBalance,
        });

      } catch (err) {
        console.error('EasySlip API request failed:', err);
        return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการเชื่อมต่อกับบริการตรวจสอบสลิป' }, { status: 500 });
      }
    }

    // Default processing for TrueMoney Wallet Gift or TrueMoney Cashcard
    if (method === 'TrueMoney Wallet Gift' && !config.wallet?.enabled) {
      return NextResponse.json({ error: 'ช่องทาง TrueMoney Gift Link ปิดปรับปรุงชั่วคราว' }, { status: 400 });
    }

    if (method === 'TrueMoney Cashcard' && !config.cashcard?.enabled) {
      return NextResponse.json({ error: 'ช่องทาง TrueMoney Cashcard ปิดปรับปรุงชั่วคราว' }, { status: 400 });
    }

    if (!amount || amount <= 0) {
      return NextResponse.json({ error: 'กรุณาระบุจำนวนเงินที่ถูกต้อง' }, { status: 400 });
    }

    const nextBalance = Number(user.balance) + Number(amount);
    const { error: updateErr } = await supabaseAdmin
      .from('users')
      .update({ balance: nextBalance })
      .eq('id', user.id);

    if (updateErr) throw updateErr;

    // บันทึกรายการธุรกรรม
    const { error: txErr } = await supabaseAdmin
      .from('transactions')
      .insert([
        {
          user_id: user.id,
          type: 'topup',
          amount: Number(amount),
          description: `เติมเงินผ่าน ${method || 'ช่องทางอื่น'} อ้างอิง: ${refCode || 'MOCK-' + Math.random().toString(36).substr(2, 9).toUpperCase()}`,
          status: 'completed',
        }
      ]);

    if (txErr) throw txErr;

    await notifyTopup({
      username: user.username || user.email,
      amount,
      method: method || 'ช่องทางอื่น',
    });

    return NextResponse.json({
      message: 'เติมเงินสำเร็จแล้ว!',
      newBalance: nextBalance,
    });
  } catch (error) {
    console.error('Topup error:', error);
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการประมวลผลการเติมเงิน' }, { status: 500 });
  }
}

