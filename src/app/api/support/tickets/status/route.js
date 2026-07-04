import { supabaseAdmin } from '@/lib/supabase';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../auth/[...nextauth]/route';
import { NextResponse } from 'next/server';

export async function PUT(request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบก่อนทำรายการ' }, { status: 401 });
    }

    const { ticketId, status } = await request.json();

    if (!ticketId || !status) {
      return NextResponse.json({ error: 'กรุณาระบุข้อมูลที่ต้องการอัปเดต' }, { status: 400 });
    }

    // 1. ดึงข้อมูลตั๋ว
    const { data: ticket, error: ticketErr } = await supabaseAdmin
      .from('support_tickets')
      .select('*')
      .eq('id', ticketId)
      .maybeSingle();

    if (ticketErr) throw ticketErr;
    if (!ticket) {
      return NextResponse.json({ error: 'ไม่พบตั๋วช่วยเหลือที่ระบุ' }, { status: 404 });
    }

    const isAdmin = session.user.role === 'admin';

    // 2. เช็คสิทธิ์:
    // ผู้ใช้ธรรมดาสามารถกด "ปิดตั๋ว" (status = 'closed') ตั๋วตัวเองได้
    // แอดมินสามารถเปลี่ยนสถานะตั๋วคำร้องใดๆ ก็ได้
    if (!isAdmin) {
      if (ticket.user_id !== session.user.id) {
        return NextResponse.json({ error: 'ไม่มีสิทธิ์เข้าถึงตั๋วช่วยเหลือนี้' }, { status: 403 });
      }
      if (status !== 'closed') {
        return NextResponse.json({ error: 'สิทธิ์ของคุณทำได้เพียงกดปิดตั๋วเท่านั้น' }, { status: 400 });
      }
    }

    // 3. ทำการอัปเดตสถานะตั๋ว
    const { data: updatedTicket, error: updateErr } = await supabaseAdmin
      .from('support_tickets')
      .update({ status })
      .eq('id', ticketId)
      .select('*')
      .single();

    if (updateErr) throw updateErr;

    const formattedTicket = {
      ...updatedTicket,
      _id: updatedTicket.id,
      createdAt: updatedTicket.created_at
    };

    return NextResponse.json({
      message: 'อัปเดตสถานะตั๋วช่วยเหลือสำเร็จแล้ว!',
      ticket: formattedTicket
    });

  } catch (error) {
    console.error('Update ticket status error:', error);
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการอัปเดตสถานะตั๋ว' }, { status: 500 });
  }
}
