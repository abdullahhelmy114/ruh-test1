// lib/upload-file.ts
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { v4 as uuidv4 } from "uuid";

const UPLOAD_ROOT = path.join(process.cwd(), "uploads");

export async function uploadFile(
  file: File,
  folder: string,
  uid: string
): Promise<{ url: string; fileName: string }> {
  const ext = path.extname(file.name);
  const uniqueName = `${uuidv4()}${ext}`;

  const uploadDir = path.join(UPLOAD_ROOT, folder, uid);
  await mkdir(uploadDir, { recursive: true });

  const filePath = path.join(uploadDir, uniqueName);
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  await writeFile(filePath, buffer);

  return {
    url: `/api/uploads/${folder}/${uid}/${uniqueName}`,
    fileName: uniqueName,
  };
}