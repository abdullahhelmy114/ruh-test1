// lib/upload-file.ts
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import {
  buildStoredFileName,
  isAllowedFolder,
  isSafeSegment,
  resolveWithinRoot,
  validateUpload,
} from "@/lib/security/upload-policy";

const UPLOAD_ROOT = path.join(process.cwd(), "uploads");

// Phase 3 batch 2: this helper duplicated the vulnerable path construction
// of /api/upload (client `folder` joined into the filesystem path, client
// extension kept, no size limit). It now applies the same policy: literal
// folder allowlist, extension + MIME allowlist, size cap, uuid filename and
// separator-aware containment. It throws on invalid input; callers must
// pass a server-verified uid. Signature and return shape are unchanged.
export async function uploadFile(
  file: File,
  folder: string,
  uid: string
): Promise<{ url: string; fileName: string }> {
  if (!isAllowedFolder(folder)) throw new Error("Invalid folder");
  if (!isSafeSegment(uid)) throw new Error("Invalid user directory");

  const check = validateUpload(file);
  if (!check.ok) throw new Error(check.reason);

  const uniqueName = buildStoredFileName(uuidv4(), check.ext);
  const uploadDir = resolveWithinRoot(UPLOAD_ROOT, [folder, uid]);
  const filePath = resolveWithinRoot(UPLOAD_ROOT, [folder, uid, uniqueName]);
  if (!uploadDir || !filePath) throw new Error("Invalid upload path");

  await mkdir(uploadDir, { recursive: true });
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(filePath, buffer, { flag: "wx" });

  return {
    url: `/api/uploads/${folder}/${uid}/${uniqueName}`,
    fileName: uniqueName,
  };
}
