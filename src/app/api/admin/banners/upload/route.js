import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../auth/[...nextauth]/route';
import { promises as fs } from 'fs';
import path from 'path';

export async function POST(request) {
  try {
    // Check permission
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get('file');

    if (!file) {
      return NextResponse.json({ error: 'ไม่พบไฟล์ภาพที่อัปโหลด' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Save to public/uploads directory
    const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
    
    // Ensure directory exists
    try {
      await fs.mkdir(uploadsDir, { recursive: true });
    } catch (e) {
      // Directory already exists
    }

    // Generate unique name
    const ext = path.extname(file.name) || '.jpg';
    const filename = `banner-${Date.now()}${ext}`;
    const filePath = path.join(uploadsDir, filename);

    // Write file
    await fs.writeFile(filePath, buffer);

    // Return relative public URL
    const imageUrl = `/uploads/${filename}`;
    return NextResponse.json({ imageUrl });

  } catch (error) {
    console.error('Admin banner upload error:', error);
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการอัปโหลดไฟล์ภาพ' }, { status: 500 });
  }
}
