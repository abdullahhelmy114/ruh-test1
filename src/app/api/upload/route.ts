import { NextRequest, NextResponse } from 'next/server';
import { verifyIdToken } from '@/lib/firebase/server';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

export async function POST(req: NextRequest) {
  try {
    // 1. التحقق من المستخدم (يستخرج uid من التوكن)
    const user = await verifyIdToken(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. استلام الملف والمجلد
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const folder = (formData.get('folder') as string) || 'general';

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // 3. حفظ الملف داخل مجلد uploads/folder/uid/
    const ext = path.extname(file.name) || '';
    const fileName = `${uuidv4()}${ext}`;
    const uploadDir = path.join(process.cwd(), 'uploads', folder, user.uid);
    await mkdir(uploadDir, { recursive: true });

    const filePath = path.join(uploadDir, fileName);
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(filePath, buffer);

    // 4. إرجاع رابط الوصول عبر API
    const publicUrl = `/api/uploads/${folder}/${user.uid}/${fileName}`;
    return NextResponse.json({ url: publicUrl });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}