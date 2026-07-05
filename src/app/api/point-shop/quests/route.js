import { supabaseAdmin } from '@/lib/supabase';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบก่อนทำรายการ' }, { status: 401 });
    }

    const todayStr = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD local

    // ดึงภารกิจที่ทำสำเร็จในวันนี้
    const { data: userQuests, error } = await supabaseAdmin
      .from('user_quests')
      .select('*')
      .eq('user_id', session.user.id)
      .eq('completed_date', todayStr);

    if (error) throw error;

    const questsConfig = [
      { key: 'daily_checkin', name: 'เช็คอินประจำวัน', desc: 'ล็อกอินเข้าสู่ระบบและกดเช็คอินเพื่อรับแต้มฟรี', points: 5 },
      { key: 'daily_purchase', name: 'นักช้อปรายวัน', desc: 'ทำรายการซื้อสินค้าชนิดใดก็ได้ครบ 1 ชิ้นในวันนี้', points: 15 },
      { key: 'daily_gacha', name: 'นักสุ่มรายวัน', desc: 'ทำรายการสุ่มกาชาตู้ใดก็ได้ครบ 1 ครั้งในวันนี้', points: 10 },
    ];

    const mappedQuests = questsConfig.map(q => {
      const dbRecord = (userQuests || []).find(uq => uq.quest_type === q.key);
      return {
        ...q,
        completed: !!dbRecord,
        claimed: dbRecord ? dbRecord.is_claimed : false
      };
    });

    // ดึงประวัติธุรกรรมพอยท์ล่าสุด 10 รายการ
    const { data: history } = await supabaseAdmin
      .from('point_transactions')
      .select('*')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false })
      .limit(10);

    return NextResponse.json({ quests: mappedQuests, history: history || [] });
  } catch (error) {
    console.error('Fetch quests error:', error);
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการดึงข้อมูลภารกิจประจำวัน' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบก่อนทำรายการ' }, { status: 401 });
    }

    const { action, questType } = await request.json();
    const todayStr = new Date().toLocaleDateString('en-CA');

    const { data: user, error: userErr } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('id', session.user.id)
      .maybeSingle();

    if (userErr) throw userErr;
    if (!user) {
      return NextResponse.json({ error: 'ไม่พบข้อมูลผู้ใช้งาน' }, { status: 404 });
    }

    if (action === 'checkin') {
      // 1. ตรวจสอบว่าเช็คอินไปหรือยัง
      const { data: existingCheckin } = await supabaseAdmin
        .from('user_quests')
        .select('*')
        .eq('user_id', user.id)
        .eq('quest_type', 'daily_checkin')
        .eq('completed_date', todayStr)
        .maybeSingle();

      if (existingCheckin) {
        return NextResponse.json({ error: 'คุณทำการเช็คอินประจำวันนี้ไปแล้ว!' }, { status: 400 });
      }

      // 2. บันทึกเควสเช็คอิน (claimed = true ทันที)
      const { error: insertErr } = await supabaseAdmin
        .from('user_quests')
        .insert([{
          user_id: user.id,
          quest_type: 'daily_checkin',
          completed_date: todayStr,
          is_claimed: true
        }]);

      if (insertErr) throw insertErr;

      // 3. เพิ่มพอยท์ให้ผู้ใช้งาน (+5 แต้ม)
      const nextPoints = (Number(user.points) || 0) + 5;
      const { error: userUpdateErr } = await supabaseAdmin
        .from('users')
        .update({ points: nextPoints })
        .eq('id', user.id);

      if (userUpdateErr) throw userUpdateErr;

      // 4. บันทึกประวัติพอยท์
      await supabaseAdmin
        .from('point_transactions')
        .insert([{
          user_id: user.id,
          type: 'earn',
          amount: 5,
          description: 'ได้รับแต้มจากการเช็คอินประจำวัน 📅'
        }]);

      return NextResponse.json({
        message: 'เช็คอินสำเร็จ! ได้รับ 5 แต้มสะสม',
        newPoints: nextPoints
      });
    }

    if (action === 'claim') {
      if (!questType || !['daily_purchase', 'daily_gacha'].includes(questType)) {
        return NextResponse.json({ error: 'ประเภทภารกิจไม่ถูกต้อง' }, { status: 400 });
      }

      // 1. ตรวจสอบว่าภารกิจทำสำเร็จจริงและยังไม่ได้เคลม
      const { data: questRecord, error: qErr } = await supabaseAdmin
        .from('user_quests')
        .select('*')
        .eq('user_id', user.id)
        .eq('quest_type', questType)
        .eq('completed_date', todayStr)
        .maybeSingle();

      if (qErr) throw qErr;
      if (!questRecord) {
        return NextResponse.json({ error: 'ภารกิจนี้ยังไม่เสร็จสิ้น' }, { status: 400 });
      }

      if (questRecord.is_claimed) {
        return NextResponse.json({ error: 'คุณรับแต้มรางวัลจากภารกิจนี้ไปแล้ว' }, { status: 400 });
      }

      // กำหนดคะแนนรางวัล
      const pointsReward = questType === 'daily_purchase' ? 15 : 10;
      const questName = questType === 'daily_purchase' ? 'นักช้อปรายวัน' : 'นักสุ่มรายวัน';

      // 2. อัปเดตสถานะการเคลมเป็น true
      const { error: updateQuestErr } = await supabaseAdmin
        .from('user_quests')
        .update({ is_claimed: true })
        .eq('id', questRecord.id);

      if (updateQuestErr) throw updateQuestErr;

      // 3. เพิ่มคะแนนพอยท์ให้ผู้ใช้งาน
      const nextPoints = (Number(user.points) || 0) + pointsReward;
      const { error: userUpdateErr } = await supabaseAdmin
        .from('users')
        .update({ points: nextPoints })
        .eq('id', user.id);

      if (userUpdateErr) throw userUpdateErr;

      // 4. บันทึกประวัติพอยท์
      await supabaseAdmin
        .from('point_transactions')
        .insert([{
          user_id: user.id,
          type: 'earn',
          amount: pointsReward,
          description: `ได้รับแต้มรางวัลจากภารกิจ: ${questName} 🎯`
        }]);

      return NextResponse.json({
        message: `เคลมแต้มภารกิจสำเร็จ! ได้รับ ${pointsReward} แต้มสะสม`,
        newPoints: nextPoints
      });
    }

    return NextResponse.json({ error: 'การกระทำไม่ถูกต้อง' }, { status: 400 });
  } catch (error) {
    console.error('Quest action error:', error);
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการดำเนินงานภารกิจ' }, { status: 500 });
  }
}
