import { supabaseAdmin } from '@/lib/supabase';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]/route';
import { NextResponse } from 'next/server';
import { notifyNewTicket } from '@/lib/adminNotifications';

export async function GET(request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบก่อนทำรายการ' }, { status: 401 });
    }

    const isAdmin = session.user.role === 'admin';

    let query = supabaseAdmin
      .from('support_tickets')
      .select('*, users:user_id (username, email)');

    if (!isAdmin) {
      // ผู้ใช้ธรรมดา ดูได้แค่ของตัวเอง
      query = query.eq('user_id', session.user.id);
    }

    const { data: tickets, error } = await query.order('created_at', { ascending: false });

    if (error) throw error;

    const formattedTickets = tickets.map(t => ({
      ...t,
      _id: t.id,
      user: t.users ? { _id: t.user_id, username: t.users.username, email: t.users.email } : null,
      createdAt: t.created_at
    }));

    return NextResponse.json(formattedTickets);
  } catch (error) {
    console.error('Fetch tickets error:', error);
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการดึงข้อมูลตั๋วช่วยเหลือ' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบก่อนทำรายการ' }, { status: 401 });
    }

    const { title, category, description } = await request.json();

    if (!title || !category || !description) {
      return NextResponse.json({ error: 'กรุณากรอกข้อมูลให้ครบถ้วน' }, { status: 400 });
    }

    // 1. สร้างตั๋วคำร้องใหม่
    const { data: ticket, error: ticketErr } = await supabaseAdmin
      .from('support_tickets')
      .insert([
        {
          user_id: session.user.id,
          title,
          category,
          description,
          status: 'open'
        }
      ])
      .select('*')
      .single();

    if (ticketErr) throw ticketErr;

    // 2. สร้างข้อความแรกลงใน support_messages
    const { error: msgErr } = await supabaseAdmin
      .from('support_messages')
      .insert([
        {
          ticket_id: ticket.id,
          user_id: session.user.id,
          message: description,
          is_admin_reply: false
        }
      ]);

    if (msgErr) throw msgErr;

    await notifyNewTicket({
      ticketId: ticket.id,
      title,
      username: session.user.name || session.user.email,
    });

    const formattedTicket = {
      ...ticket,
      _id: ticket.id,
      createdAt: ticket.created_at
    };

    return NextResponse.json({ 
      message: 'เปิดตั๋วช่วยเหลือสำเร็จแล้ว!', 
      ticket: formattedTicket 
    }, { status: 201 });

  } catch (error) {
    console.error('Create ticket error:', error);
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการเปิดตั๋วช่วยเหลือ' }, { status: 500 });
  }
}
