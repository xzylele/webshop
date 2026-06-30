import { supabaseAdmin } from '@/lib/supabase';
import bcrypt from 'bcryptjs';
import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const { username, email, password } = await request.json();

    if (!username || !email || !password) {
      return NextResponse.json(
        { error: 'กรุณากรอกข้อมูลให้ครบถ้วน' },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: 'รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษร' },
        { status: 400 }
      );
    }

    // ตรวจสอบอีเมลซ้ำ
    const { data: emailExists, error: emailErr } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('email', email.toLowerCase())
      .maybeSingle();

    if (emailErr) throw emailErr;
    if (emailExists) {
      return NextResponse.json(
        { error: 'อีเมลนี้ถูกใช้งานไปแล้ว' },
        { status: 400 }
      );
    }

    // ตรวจสอบชื่อผู้ใช้ซ้ำ
    const { data: usernameExists, error: userErr } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('username', username)
      .maybeSingle();

    if (userErr) throw userErr;
    if (usernameExists) {
      return NextResponse.json(
        { error: 'ชื่อผู้ใช้งานนี้ถูกใช้งานไปแล้ว' },
        { status: 400 }
      );
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    
    // ตั้งค่าให้คนแรกเป็นแอดมิน (ถ้ายังไม่มีแอดมิน)
    const { count: adminCount, error: countErr } = await supabaseAdmin
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('role', 'admin');

    if (countErr) throw countErr;
    const role = (adminCount || 0) === 0 ? 'admin' : 'user';

    const { data: newUser, error: createErr } = await supabaseAdmin
      .from('users')
      .insert([
        {
          username,
          email: email.toLowerCase(),
          password: hashedPassword,
          role,
          balance: 0,
          total_spent: 0
        }
      ])
      .select('id')
      .single();

    if (createErr) throw createErr;

    return NextResponse.json(
      { message: 'สมัครสมาชิกสำเร็จแล้ว', userId: newUser.id },
      { status: 201 }
    );
  } catch (error) {
    console.error('Signup error:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์' },
      { status: 500 }
    );
  }
}

