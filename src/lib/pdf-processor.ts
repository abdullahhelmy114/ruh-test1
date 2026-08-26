// src/lib/pdf-processor.ts
export const runtime = 'nodejs';

import { getDocument } from 'pdfjs-dist';
import sharp from 'sharp';
import { uploadFileToGoogleDrive, downloadFileFromGoogleDrive, extractGoogleDriveFileId } from './google-drive';
import { db } from '@/lib/db';

/**
 * تحويل ملف PDF إلى صور صفحات واستخراج النصوص
 */
export async function processPdfForBook(
  bookId: string,
  pdfBuffer: Buffer,
  sourceType: 'upload' | 'url',
  sourceUrl?: string
): Promise<void> {
  try {
    await db.query(
      `UPDATE library_books SET processing_status = 'processing' WHERE id = $1`,
      [bookId]
    );

    let buffer = pdfBuffer;
    if (sourceType === 'url' && sourceUrl) {
      buffer = await fetchPdfFromUrl(sourceUrl);
    }

    const pdf = await getDocument({
      data: new Uint8Array(buffer),
      useSystemFonts: true,
      disableFontFace: false,
    }).promise;

    const totalPages = pdf.numPages;

    await db.query(
      `UPDATE library_books SET pages_count = $1 WHERE id = $2`,
      [totalPages, bookId]
    );

    for (let pageNumber = 1; pageNumber <= totalPages; pageNumber++) {
      await processSinglePage(bookId, pdf, pageNumber);
    }

    await db.query(
      `UPDATE library_books SET processing_status = 'ready', extracted_text_completed = true WHERE id = $1`,
      [bookId]
    );

    console.log(`تمت معالجة الكتاب ${bookId} بنجاح (${totalPages} صفحة)`);
  } catch (error) {
    console.error(`فشل معالجة الكتاب ${bookId}:`, error);
    await db.query(
      `UPDATE library_books SET processing_status = 'failed' WHERE id = $1`,
      [bookId]
    );
    throw new Error('فشل معالجة ملف PDF');
  }
}

async function processSinglePage(bookId: string, pdf: any, pageNumber: number): Promise<void> {
  const page = await pdf.getPage(pageNumber);

  // استخراج النص من الصفحة
  const textContent = await page.getTextContent();
  const text = textContent.items.map((item: any) => item.str).join(' ');

  // في هذه النسخة نقوم بإنشاء صورة فارغة (placeholder) بدلاً من عرض الصفحة
  // لتجنب مشاكل مكتبة @napi-rs/canvas في بيئة ESM
  // يمكن لاحقاً استبدالها بحل مناسب لعرض الصفحات إن لزم
  const viewport = page.getViewport({ scale: 1.0 });
  const pageWidth = Math.floor(viewport.width);
  const pageHeight = Math.floor(viewport.height);

  const imageBuffer = await sharp({
    create: {
      width: pageWidth,
      height: pageHeight,
      channels: 3,
      background: { r: 255, g: 255, b: 255 },
    },
  })
    .jpeg({ quality: 90 })
    .toBuffer();

  const imageFileId = await uploadFileToGoogleDrive(
    imageBuffer,
    `book_${bookId}_page_${pageNumber}.jpg`,
    'image/jpeg'
  );

  await db.query(
    `INSERT INTO library_pages (book_id, page_number, image_file_id, text_content)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (book_id, page_number)
     DO UPDATE SET
       image_file_id = EXCLUDED.image_file_id,
       text_content = EXCLUDED.text_content,
       created_at = now()`,
    [bookId, pageNumber, imageFileId, text]
  );

  await db.query(
    `INSERT INTO book_texts (book_id, page_number, text_content)
     VALUES ($1, $2, $3)
     ON CONFLICT (book_id, page_number)
     DO UPDATE SET text_content = EXCLUDED.text_content, updated_at = now()`,
    [bookId, pageNumber, text]
  );
}

async function fetchPdfFromUrl(url: string): Promise<Buffer> {
  const fileId = extractGoogleDriveFileId(url);
  if (fileId) {
    return await downloadFileFromGoogleDrive(fileId);
  }

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`فشل تحميل PDF من الرابط: ${response.status}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}