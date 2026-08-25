// src/lib/google-drive.ts
import { google } from "googleapis";
import { Readable } from "stream";

// إعداد OAuth2 من متغيرات البيئة
const clientId = process.env.GOOGLE_CLIENT_ID!;
const clientSecret = process.env.GOOGLE_CLIENT_SECRET!;
const refreshToken = process.env.GOOGLE_REFRESH_TOKEN!;
const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID || "";

const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
oauth2Client.setCredentials({ refresh_token: refreshToken });

const drive = google.drive({ version: "v3", auth: oauth2Client });

/**
 * رفع ملف إلى Google Drive بصلاحيات خاصة (restricted) وليس عامًا
 * @param fileBuffer محتوى الملف
 * @param fileName اسم الملف
 * @param mimeType نوع الملف
 * @returns معرف الملف في Google Drive
 */
export async function uploadFileToGoogleDrive(
  fileBuffer: Buffer,
  fileName: string,
  mimeType: string
): Promise<string> {
  try {
    const stream = Readable.from(fileBuffer);

    const response = await drive.files.create({
      requestBody: {
        name: fileName,
        parents: folderId ? [folderId] : [],
        mimeType: mimeType,
      },
      media: {
        mimeType: mimeType,
        body: stream,
      },
      fields: "id",
    });

    const fileId = response.data.id;
    if (!fileId) throw new Error("Failed to get file ID");

    // لا نضيف أي صلاحيات عامة، بل نترك الملف خاصًا (restricted)
    // للتأكد من عدم وجود صلاحيات عامة سابقة، نحذف أي صلاحيات من نوع anyone
    await removePublicPermissions(fileId);

    return fileId; // نرجع المعرف فقط، وليس رابطًا مباشرًا
  } catch (error) {
    console.error("خطأ في رفع الملف إلى Google Drive:", error);
    throw new Error("فشل رفع الملف إلى Google Drive");
  }
}

/**
 * حذف أي صلاحيات عامة من ملف معين
 * @param fileId معرف الملف
 */
async function removePublicPermissions(fileId: string): Promise<void> {
  try {
    const permissions = await drive.permissions.list({
      fileId,
      fields: "permissions(id, type, role)",
    });

    const publicPermissions = permissions.data.permissions?.filter(
      (p) => p.type === "anyone" || p.type === "anyoneWithLink"
    );

    for (const perm of publicPermissions || []) {
      if (perm.id) {
        await drive.permissions.delete({
          fileId,
          permissionId: perm.id,
        });
      }
    }
  } catch (error) {
    console.warn("تعذر حذف الصلاحيات العامة (قد لا تكون موجودة):", error);
  }
}

/**
 * تنزيل محتوى ملف خاص من Google Drive باستخدام OAuth2
 * @param fileId معرف الملف
 * @returns Buffer يحتوي على محتوى الملف
 */
export async function downloadFileFromGoogleDrive(fileId: string): Promise<Buffer> {
  try {
    const response = await drive.files.get(
      {
        fileId,
        alt: "media",
      },
      { responseType: "arraybuffer" }
    );

    const data = response.data as ArrayBuffer;
    return Buffer.from(data);
  } catch (error) {
    console.error("خطأ في تنزيل الملف من Google Drive:", error);
    throw new Error("فشل تنزيل الملف من Google Drive");
  }
}

/**
 * جلب بيانات وصفية عن ملف (مثل نوع المحتوى)
 * @param fileId معرف الملف
 */
export async function getFileMetadata(fileId: string): Promise<{
  mimeType: string;
  name: string;
}> {
  try {
    const response = await drive.files.get({
      fileId,
      fields: "mimeType, name",
    });

    return {
      mimeType: response.data.mimeType || "application/octet-stream",
      name: response.data.name || "file",
    };
  } catch (error) {
    console.error("خطأ في جلب بيانات الملف من Google Drive:", error);
    throw new Error("فشل جلب بيانات الملف من Google Drive");
  }
}

/**
 * استخراج معرف الملف من رابط Google Drive عام (للاستخدام عند الحاجة)
 */
export function extractGoogleDriveFileId(url: string): string | null {
  const patterns = [
    /\/file\/d\/([a-zA-Z0-9_-]+)/,
    /[?&]id=([a-zA-Z0-9_-]+)/,
    /\/open\?id=([a-zA-Z0-9_-]+)/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }
  return null;
}

/**
 * إنشاء مجلد جديد في Drive (اختياري)
 */
export async function createDriveFolder(
  folderName: string,
  parentFolderId?: string
): Promise<string> {
  const response = await drive.files.create({
    requestBody: {
      name: folderName,
      mimeType: "application/vnd.google-apps.folder",
      parents: parentFolderId ? [parentFolderId] : [],
    },
    fields: "id",
  });
  return response.data.id || "";
}