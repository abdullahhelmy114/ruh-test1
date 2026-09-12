import { NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { requireAuth, HttpError } from '@/lib/auth';
import { withApi } from '@/lib/api/handler';
import {
  buildStoredFileName,
  isAllowedFolder,
  isSafeSegment,
  resolveWithinRoot,
  validateUpload,
} from '@/lib/security/upload-policy';

export const runtime = 'nodejs';

const UPLOAD_ROOT = path.join(process.cwd(), 'uploads');

// Phase 3 batch 2 — upload boundary.
// Previously the client-supplied `folder` was joined straight into the
// filesystem path (`../public` escaped the upload root), the client's file
// extension was kept verbatim (an .html upload became active content), and
// there was no size limit. Now:
//   - caller identity comes from the central auth layer (uid = directory)
//   - `folder` must be a literal member of ALLOWED_UPLOAD_FOLDERS
//   - extension AND MIME type are allowlisted and must agree; no HTML/SVG/scripts
//   - size is capped server-side (MAX_UPLOAD_BYTES)
//   - the stored name is uuid + allowlisted extension, never the client name
//   - the final path is resolved and proven to stay under uploads/<folder>/<uid>
// Response shape ({ url }) is unchanged.
export const POST = withApi(async (req) => {
  const user = await requireAuth(req);

  const formData = await req.formData().catch(() => null);
  if (!formData) throw new HttpError(400, 'Invalid multipart body');

  const file = formData.get('file');
  const folderInput = formData.get('folder') ?? 'general';

  if (!(file instanceof File)) throw new HttpError(400, 'No file provided');
  if (!isAllowedFolder(folderInput)) throw new HttpError(400, 'Invalid folder');
  if (!isSafeSegment(user.uid)) throw new HttpError(400, 'Invalid user directory');

  const check = validateUpload(file);
  if (!check.ok) throw new HttpError(check.status, check.reason);

  const fileName = buildStoredFileName(uuidv4(), check.ext);
  const uploadDir = resolveWithinRoot(UPLOAD_ROOT, [folderInput, user.uid]);
  const filePath = resolveWithinRoot(UPLOAD_ROOT, [folderInput, user.uid, fileName]);
  if (!uploadDir || !filePath) throw new HttpError(400, 'Invalid upload path');

  try {
    await mkdir(uploadDir, { recursive: true });
    const buffer = Buffer.from(await file.arrayBuffer());
    if (buffer.byteLength !== file.size) throw new Error('size mismatch');
    await writeFile(filePath, buffer, { flag: 'wx' });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }

  const publicUrl = `/api/uploads/${folderInput}/${user.uid}/${fileName}`;
  return NextResponse.json({ url: publicUrl });
});
