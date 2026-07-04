import { supabaseAdmin } from '@/lib/supabase';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../auth/[...nextauth]/route';
import { NextResponse } from 'next/server';

async function checkAdmin() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'admin') {
    return false;
  }
  return session;
}

export async function POST(request) {
  try {
    const session = await checkAdmin();
    if (!session) {
      return NextResponse.json({ error: 'ไม่มีสิทธิ์เข้าถึงข้อมูลนี้' }, { status: 403 });
    }

    const { ticketId } = await request.json();
    if (!ticketId) {
      return NextResponse.json({ error: 'กรุณาระบุไอดีตั๋วช่วยเหลือ' }, { status: 400 });
    }

    // 1. ดึงข้อมูลตั๋วช่วยเหลือ
    const { data: ticket, error: ticketErr } = await supabaseAdmin
      .from('support_tickets')
      .select('*')
      .eq('id', ticketId)
      .maybeSingle();

    if (ticketErr) throw ticketErr;
    if (!ticket) {
      return NextResponse.json({ error: 'ไม่พบตั๋วช่วยเหลือที่ระบุ' }, { status: 404 });
    }

    if (ticket.status === 'closed') {
      return NextResponse.json({ error: 'ตั๋วคำร้องนี้ถูกปิดไปแล้ว' }, { status: 400 });
    }

    // 2. วิเคราะห์หา Transaction ID และยอดเงินจาก Description
    const desc = ticket.description || '';
    const txIdMatch = desc.match(/Transaction ID:\s*([a-f0-9\-]{36})/i);
    if (!txIdMatch) {
      return NextResponse.json({ error: 'ตั๋วนี้ไม่ได้เชื่อมโยงกับธุรกรรมการซื้อที่ถูกต้อง' }, { status: 400 });
    }
    const txId = txIdMatch[1];

    // 3. ตรวจสอบว่าเคยคืนเงินไปแล้วหรือยังจากประวัติธุรกรรม
    const { data: existingRefund, error: checkErr } = await supabaseAdmin
      .from('transactions')
      .select('id')
      .eq('user_id', ticket.user_id)
      .like('description', `%คืนเงินตั๋วช่วยเหลือ #${ticket.id.substring(0, 8)}%`)
      .maybeSingle();

    if (checkErr) throw checkErr;
    if (existingRefund) {
      return NextResponse.json({ error: 'ตั๋วคำร้องนี้ได้รับการคืนเงินสำเร็จไปก่อนหน้านี้แล้ว' }, { status: 400 });
    }

    // 4. ดึงข้อมูลธุรกรรมต้นทางเพื่อตรวจสอบยอดเงินคืน
    const { data: tx, error: txErr } = await supabaseAdmin
      .from('transactions')
      .select('*')
      .eq('id', txId)
      .maybeSingle();

    if (txErr) throw txErr;
    if (!tx) {
      return NextResponse.json({ error: 'ไม่พบข้อมูลธุรกรรมต้นทางที่ใช้เปิดตั๋ว' }, { status: 400 });
    }

    const refundAmount = Math.abs(Number(tx.amount));
    if (refundAmount <= 0) {
      return NextResponse.json({ error: 'ยอดเงินสำหรับคืนไม่ถูกต้อง' }, { status: 400 });
    }

    // 5. ดึงข้อมูลลูกค้าเพื่อคำนวณยอดเงินใหม่
    const { data: customer, error: customerErr } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('id', ticket.user_id)
      .maybeSingle();

    if (customerErr) throw customerErr;
    if (!customer) {
      return NextResponse.json({ error: 'ไม่พบผู้ใช้งานเจ้าของตั๋วคำร้อง' }, { status: 400 });
    }

    // 6. ดำเนินการอัปเดตยอดเงินเครดิตของลูกค้า
    const newBalance = Number(customer.balance) + refundAmount;
    const { error: updateBalanceErr } = await supabaseAdmin
      .from('users')
      .update({ balance: newBalance })
      .eq('id', customer.id);

    if (updateBalanceErr) throw updateBalanceErr;

    // 7. บันทึกประวัติการคืนเงินลงในตาราง Transactions
    const productName = tx.description.split('\n')[0].replace('ซื้อสินค้า: ', '').trim();
    const { error: insertTxErr } = await supabaseAdmin
      .from('transactions')
      .insert([
        {
          user_id: customer.id,
          type: 'refund',
          amount: refundAmount,
          description: `คืนเงินตั๋วช่วยเหลือ #${ticket.id.substring(0, 8)} สำหรับสินค้า: ${productName}`,
          status: 'completed'
        }
      ]);

    if (insertTxErr) throw insertTxErr;

    // 8. เขียนข้อความตอบกลับระบบแชทในฐานะระบบบอทอัตโนมัติ
    const { error: insertMsgErr } = await supabaseAdmin
      .from('support_messages')
      .insert([
        {
          ticket_id: ticket.id,
          user_id: session.user.id, // ID ของแอดมินผู้กระทำการ
          message: `🤖 ระบบ: ดำเนินการคืนเงินสำเร็จจำนวน ${refundAmount.toLocaleString()} THB เข้าสู่บัญชีเครดิตของท่านเรียบร้อยแล้ว`,
          is_admin_reply: true
        }
      ]);

    if (insertMsgErr) throw insertMsgErr;

    // 9. ทำการปิดสถานะตั๋วช่วยเหลือเรียบร้อย
    const { error: updateTicketErr } = await supabaseAdmin
      .from('support_tickets')
      .update({ status: 'closed' })
      .eq('id', ticketId);

    if (updateTicketErr) throw updateTicketErr;

    return NextResponse.json({
      message: 'ดำเนินการคืนเงินเครดิตและปิดตั๋วคำร้องเรียบร้อยแล้ว',
      refundAmount
    }, { status: 200 });

  } catch (error) {
    console.error('Approve refund error:', error);
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการประมวลผลการคืนเงิน' }, { status: 500 });
  }
}
