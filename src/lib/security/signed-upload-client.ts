/**
 * Browser side of the signed direct upload (Phase 3 closure fix F2, now with
 * private delivery). The browser validates the file locally, asks
 * /api/cloudinary/sign-upload for a signature over parameters the SERVER
 * chose for a fixed purpose, uploads straight to Cloudinary, and keeps only
 * the server-issued reference (storage id + proof) that an application sends
 * back. No unsigned preset, no cloud name or secret here, no file bytes
 * through our server, and no public link: documents are delivered only
 * through short-lived links issued to administrators.
 */
import { checkFileForPurpose, cloudinaryUploadUrl, type UploadPurpose } from "./upload-purpose.ts";

export interface UploadReference {
  readonly storageId: string;
  readonly proof: string;
}

export type SignedUploadFailure = "size" | "empty" | "type" | "authorisation" | "upload";

export class SignedUploadError extends Error {
  readonly reason: SignedUploadFailure;
  constructor(reason: SignedUploadFailure) {
    super(`upload failed: ${reason}`);
    this.name = "SignedUploadError";
    this.reason = reason;
  }
}

export async function uploadSigned(file: File, purpose: UploadPurpose): Promise<UploadReference> {
  const check = checkFileForPurpose(file, purpose);
  if (!check.ok) throw new SignedUploadError(check.reason);

  const signRes = await fetch("/api/cloudinary/sign-upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ purpose }),
  });
  if (!signRes.ok) throw new SignedUploadError("authorisation");
  const auth = await signRes.json();

  const formData = new FormData();
  formData.append("file", file);
  // Exactly the server-signed parameters (server-issued public_id,
  // overwrite=false, the server-selected signed upload_preset and the
  // authenticated delivery type), plus the non-secret api_key and the
  // signature. Any deviation makes Cloudinary reject the signature.
  formData.append("timestamp", String(auth.timestamp));
  formData.append("folder", auth.folder);
  formData.append("allowed_formats", auth.allowedFormats);
  formData.append("public_id", auth.publicId);
  formData.append("overwrite", "false");
  formData.append("upload_preset", auth.uploadPreset);
  formData.append("type", auth.deliveryType);
  formData.append("api_key", auth.apiKey);
  formData.append("signature", auth.signature);

  const res = await fetch(cloudinaryUploadUrl(auth.cloudName, purpose), { method: "POST", body: formData });
  if (!res.ok) throw new SignedUploadError("upload");
  const uploaded = await res.json();
  // The stored asset must be the one the server signed for; the reference is the server's, never the response's.
  if (uploaded?.public_id !== auth.reference?.storageId) throw new SignedUploadError("upload");
  return { storageId: auth.reference.storageId, proof: auth.reference.proof };
}
