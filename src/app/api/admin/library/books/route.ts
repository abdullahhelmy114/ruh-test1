// src/app/api/admin/library/books/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { uploadFileToGoogleDrive } from '@/lib/google-drive';
import { processPdfForBook } from '@/lib/pdf-processor';
import { db } from '@/lib/db';
import { randomUUID } from 'crypto';

// دالة التحقق من صلاحية الأدمن (يجب تعديلها حسب نظام المصادقة الحالي)
async function isAdmin(request: NextRequest): Promise<boolean> {
  // مثال: تحقق من وجود جلسة أدمن أو تحقق من Firebase Token
  // يمكنك استيراد دالة التحقق الخاصة بك من src/lib/auth أو firebase-admin
  // هنا نعيد true للتبسيط، لكن يجب استبدالها بالتحقق الفعلي
  return true;
}

export async function POST(request: NextRequest) {
  // التحقق من صلاحية الأدمن
  if (!(await isAdmin(request))) {
    return NextResponse.json({ error: 'غير مصرح لك بالوصول' }, { status: 401 });
  }

  try {
    const formData = await request.formData();

    // استخراج البيانات النصية
    const title = formData.get('title')?.toString().trim();
    const author = formData.get('author')?.toString().trim() || '';
    const description = formData.get('description')?.toString().trim() || '';
    const year = formData.get('year')?.toString().trim() || null;
    const sourceType = formData.get('source_type')?.toString() || 'upload'; // upload أو url
    const sourceUrl = formData.get('source_url')?.toString() || null;
    const accessType = formData.get('access_type')?.toString() || 'free';
    const price = parseFloat(formData.get('price')?.toString() || '0');
    const allowedPagesStr = formData.get('allowed_pages')?.toString() || '[]';
    const courseId = formData.get('course_id')?.toString() || null;
    const bundleId = formData.get('bundle_id')?.toString() || null;
    const categoriesStr = formData.get('categories')?.toString() || '[]'; // JSON array
    const flipbookConfigStr = formData.get('flipbook_config')?.toString() || '{}';

    // الملفات
    const coverFile = formData.get('cover_image') as File | null;
    const pdfFile = formData.get('pdf_file') as File | null;

    // التحقق من وجود البيانات الأساسية
    if (!title) {
      return NextResponse.json({ error: 'عنوان الكتاب مطلوب' }, { status: 400 });
    }

    if (sourceType === 'upload' && !pdfFile) {
      return NextResponse.json({ error: 'ملف PDF مطلوب' }, { status: 400 });
    }

    if (sourceType === 'url' && !sourceUrl) {
      return NextResponse.json({ error: 'رابط PDF مطلوب' }, { status: 400 });
    }

    // معالجة التصنيفات
    let categories: string[] = [];
    try {
      categories = JSON.parse(categoriesStr);
    } catch {
      categories = [];
    }

    // معالجة الصفحات المجانية
    let allowedPages: number[] = [];
    try {
      allowedPages = JSON.parse(allowedPagesStr);
    } catch {
      allowedPages = [];
    }

    // معالجة إعدادات flipbook
    let flipbookConfig: any = {};
    try {
      flipbookConfig = JSON.parse(flipbookConfigStr);
    } catch {
      flipbookConfig = {};
    }

    // توليد معرف فريد للكتاب
    const bookId = randomUUID();

    // رفع الغلاف إلى Google Drive (اختياري)
    let coverFileId: string | null = null;
    if (coverFile) {
      const coverBuffer = Buffer.from(await coverFile.arrayBuffer());
      coverFileId = await uploadFileToGoogleDrive(
        coverBuffer,
        `cover_${bookId}.jpg`,
        coverFile.type || 'image/jpeg'
      );
    }

    // رفع ملف PDF إلى Google Drive (إذا كان رفعًا مباشرًا)
    let pdfFileId: string | null = null;
    let pdfBuffer: Buffer | null = null;

    if (sourceType === 'upload' && pdfFile) {
      pdfBuffer = Buffer.from(await pdfFile.arrayBuffer());
      pdfFileId = await uploadFileToGoogleDrive(
        pdfBuffer,
        `book_${bookId}.pdf`,
        pdfFile.type || 'application/pdf'
      );
    } else if (sourceType === 'url' && sourceUrl) {
      // عند استخدام رابط، لن نرفع الملف الآن، بل سنتركه للمعالجة
      // سنحفظ الرابط في source_url وسنقوم بتنزيله في المعالجة
      pdfFileId = null;
    }

    // إدراج الكتاب في قاعدة البيانات
    await db.query(
      `INSERT INTO library_books (
        id, title, author, description, year,
        cover_file_id, file_id, source_type, source_url,
        access_type, price, processing_status,
        is_published, flipbook_config, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'uploaded', true, $12, now())`,
      [
        bookId,
        title,
        author,
        description,
        year,
        coverFileId,
        pdfFileId,
        sourceType,
        sourceUrl,
        accessType,
        price,
        JSON.stringify(flipbookConfig),
      ]
    );

    // ربط التصنيفات
    for (const categoryId of categories) {
      await db.query(
        `INSERT INTO book_categories (book_id, category_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [bookId, categoryId]
      );
    }

    // إضافة قواعد الوصول (بسيطة: نضيف قاعدة لكل كتاب حسب نوع الوصول)
    await db.query(
      `INSERT INTO library_access_rules (
        book_id, category_id, course_id, bundle_id,
        access_type, allowed_pages, price, is_active
      ) VALUES ($1, NULL, $2, $3, $4, $5, $6, true)`,
      [
        bookId,
        courseId,
        bundleId,
        accessType,
        allowedPages,
        price,
      ]
    );

    // بدء معالجة PDF (تحويل صفحات + استخراج نصوص)
    // ملاحظة: إذا كان الكتاب كبيرًا قد تستغرق المعالجة وقتًا طويلاً،
    // ويفضل تشغيلها في الخلفية أو عبر وظيفة منفصلة.
    // هنا سنشغلها بشكل متزامن للتبسيط، لكن يمكن تحويلها لاحقًا.
    try {
      if (sourceType === 'upload' && pdfBuffer) {
        await processPdfForBook(bookId, pdfBuffer, 'upload');
      } else if (sourceType === 'url' && sourceUrl) {
        await processPdfForBook(bookId, Buffer.alloc(0), 'url', sourceUrl);
      }
    } catch (processingError) {
      console.error('فشل معالجة الكتاب:', processingError);
      // لا نعيد خطأ، بل نترك الحالة failed للأدمن ليعيد المحاولة
    }

    return NextResponse.json({
      success: true,
      bookId,
      message: 'تم رفع الكتاب وبدء معالجته',
    }, { status: 201 });

  } catch (error) {
    console.error('خطأ في رفع الكتاب:', error);
    return NextResponse.json({ error: 'حدث خطأ أثناء رفع الكتاب' }, { status: 500 });
  }
}