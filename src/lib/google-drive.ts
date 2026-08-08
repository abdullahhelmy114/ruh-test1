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
 * رفع ملف إلى Google Drive
 */
export async function uploadFileToGoogleDrive(
  fileBuffer: Buffer,
  fileName: string,
  mimeType: string
): Promise<string> {
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

  // جعل الملف عاماً
  await drive.permissions.create({
    fileId: fileId,
    requestBody: { role: "reader", type: "anyone" },
  });

  // الحصول على رابط المشاهدة المباشر
  const result = await drive.files.get({
    fileId: fileId,
    fields: "webContentLink",
  });

  if (!result.data.webContentLink) {
    throw new Error("Failed to get direct link");
  }

  return result.data.webContentLink;
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
export function driveUrlToCdnUrl(driveUrl: string): string {
  // استخراج معرف الملف من الرابط
  const match = driveUrl.match(/\/d\/([^/]+)\//) || driveUrl.match(/id=([^&]+)/);
  if (!match) return driveUrl;
  const fileId = match[1];
  return `https://ruhulqudus.net/cdn/${fileId}`;
}
