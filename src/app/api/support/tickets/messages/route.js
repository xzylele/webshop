import { supabaseAdmin } from '@/lib/supabase';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../auth/[...nextauth]/route';
import { NextResponse } from 'next/server';
import { notifyTicketReply } from '@/lib/adminNotifications';

export async function GET(request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบก่อนทำรายการ' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const ticketId = searchParams.get('ticketId');

    if (!ticketId) {
      return NextResponse.json({ error: 'ไม่พบไอดีตั๋วช่วยเหลือ' }, { status: 400 });
    }

    // ตรวจสอบความถูกต้องและสิทธิ์ของผู้ใช้งานในตั๋วนี้
    const { data: ticket, error: ticketErr } = await supabaseAdmin
      .from('support_tickets')
      .select('*')
      .eq('id', ticketId)
      .maybeSingle();

    if (ticketErr) throw ticketErr;
    if (!ticket) {
      return NextResponse.json({ error: 'ไม่พบตั๋วช่วยเหลือที่ระบุ' }, { status: 404 });
    }

    // ผู้ใช้ธรรมดาดูได้เฉพาะตั๋วของตัวเองเท่านั้น ส่วนแอดมินดูได้หมด
    if (session.user.role !== 'admin' && ticket.user_id !== session.user.id) {
      return NextResponse.json({ error: 'ไม่มีสิทธิ์เข้าถึงตั๋วช่วยเหลือนี้' }, { status: 403 });
    }

    // ดึงประวัติข้อความสนทนา
    const { data: messages, error: messagesErr } = await supabaseAdmin
      .from('support_messages')
      .select('*, users:user_id (username, email)')
      .eq('ticket_id', ticketId)
      .order('created_at', { ascending: true });

    if (messagesErr) throw messagesErr;

    const formattedMessages = messages.map(m => ({
      ...m,
      _id: m.id,
      user: m.users ? { _id: m.user_id, username: m.users.username, email: m.users.email } : null,
      createdAt: m.created_at
    }));

    return NextResponse.json(formattedMessages);
  } catch (error) {
    console.error('Fetch ticket messages error:', error);
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการดึงประวัติข้อความ' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบก่อนทำรายการ' }, { status: 401 });
    }

    const { ticketId, message } = await request.json();

    if (!ticketId || !message || message.trim().length === 0) {
      return NextResponse.json({ error: 'กรุณากรอกข้อความตอบกลับ' }, { status: 400 });
    }

    // 1. ตรวจสอบตั๋วช่วยเหลือในระบบ
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

    // 2. เช็คสิทธิ์ในการตอบตั๋ว
    if (!isAdmin && ticket.user_id !== session.user.id) {
      return NextResponse.json({ error: 'ไม่มีสิทธิ์เข้าถึงตั๋วช่วยเหลือนี้' }, { status: 403 });
    }

    // 3. ป้องกันการส่งข้อความหากตั๋วถูกปิดไปแล้ว
    if (ticket.status === 'closed') {
      return NextResponse.json({ error: 'ตั๋วคำร้องนี้ถูกปิดใช้งานไปแล้ว ไม่สามารถพิมพ์ตอบกลับได้' }, { status: 400 });
    }

    // 4. บันทึกข้อความตอบกลับ
    const { data: newMessage, error: createErr } = await supabaseAdmin
      .from('support_messages')
      .insert([
        {
          ticket_id: ticketId,
          user_id: session.user.id,
          message: message.trim(),
          is_admin_reply: isAdmin
        }
      ])
      .select('*, users:user_id (username, email)')
      .single();

    if (createErr) throw createErr;

    // 5. อัปเดตสถานะของตั๋วช่วยเหลือ
    // ถ้าแอดมินตอบ -> สถานะเป็น 'replied' (ตอบกลับแล้ว)
    // ถ้าผู้ใช้ตอบ -> สถานะเป็น 'open' (เปิดคำร้องใหม่/รอแอดมินตรวจ)
    const nextStatus = isAdmin ? 'replied' : 'open';
    const { error: updateErr } = await supabaseAdmin
      .from('support_tickets')
      .update({ status: nextStatus })
      .eq('id', ticketId);

    if (updateErr) throw updateErr;

    if (!isAdmin) {
      await notifyTicketReply({
        ticketId,
        title: ticket.title,
        username: session.user.name || session.user.email,
      });
    }

    const formattedMessage = {
      ...newMessage,
      _id: newMessage.id,
      user: newMessage.users ? { _id: newMessage.user_id, username: newMessage.users.username, email: newMessage.users.email } : null,
      createdAt: newMessage.created_at
    };

    return NextResponse.json({ 
      message: 'ส่งข้อความสำเร็จแล้ว!', 
      newMessage: formattedMessage 
    }, { status: 201 });

  } catch (error) {
    console.error('Send reply message error:', error);
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการส่งข้อความตอบกลับ' }, { status: 500 });
  }
}
