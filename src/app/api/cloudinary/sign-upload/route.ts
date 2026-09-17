export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { HttpError } from "@/lib/auth";
import { withApi } from "@/lib/api/handler";
import { checkRateLimit, clientKey, retryAfterSeconds } from "@/lib/security/rate-limit";
import { isUploadPurpose, type UploadPurpose } from "@/lib/security/upload-purpose";
import { signUploadForPurpose, storageIdOf, uploadReferenceProof } from "@/lib/security/cloudinary-sign";

// Phase 3 closure fix F2 — narrow, purpose-scoped Cloudinary upload
// authorisation for the teacher signup flow.
//
// Previously the browser uploaded straight to Cloudinary with an UNSIGNED
// preset and cloud name hard-coded in client code, so anyone could push
// arbitrary files into the academy's account. Now the browser asks this
// route for a short-lived signature over parameters the SERVER chooses
// (timestamp, folder, allowed_formats, public_id, overwrite, and the
// purpose's SIGNED upload_preset) for one of two fixed purposes, then
// uploads directly to Cloudinary. File bytes never pass through this server.
//
// Pre-auth boundary: teacher signup happens before any session exists and
// the step-1 page has no reCAPTCHA token to reuse, so the control is the
// shared per-client limiter (10 signatures / 15 min), which bounds
// authorisation ISSUANCE. This is NOT a generic signing oracle: the request
// body may only name a purpose; folder, resource_type, public_id, overwrite,
// upload_preset, eager, tags, context, notification_url, access_control and
// timestamp are never accepted from the client. The API secret is read here,
// passed to the signer, and never returned or logged.
//
// What is and is not guaranteed (see src/lib/security/cloudinary-sign.ts):
// the fresh public_id + overwrite=false stops a reused signed set from
// storing another asset under that id within the same resource_type
// namespace; the signed purpose preset carries the provider-side format and
// byte-size ceiling (configured in the console: signed mode, pdf / 10 MB
// for CVs, mp4+mov+webm / 50 MB for videos); resource_type itself is not
// signed, so cross-resource-type reuse within the validity window remains a
// defence-in-depth residual bounded by the limiter and the preset controls.
// Client-side byte limits are UX pre-checks only.
//
// OPERATIONAL: the two signed presets must exist in the Cloudinary console
// before deploy, and the old unsigned preset must be disabled or deleted
// after deploy; code alone cannot revoke it.
const CLIENT_LIMIT = { limit: 10, windowMs: 15 * 60 * 1000 };

/** Server-selected signed preset per purpose. Never derived from the request. */
function presetFor(purpose: UploadPurpose): string | undefined {
  switch (purpose) {
    case "teacher_cv":
      return process.env.CLOUDINARY_TEACHER_CV_PRESET;
    case "teacher_intro_video":
      return process.env.CLOUDINARY_TEACHER_VIDEO_PRESET;
  }
}

export const POST = withApi(async (req) => {
  const check = checkRateLimit(`cloudinary-sign:${clientKey(req)}`, CLIENT_LIMIT);
  if (!check.allowed) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": String(retryAfterSeconds(check)) } }
    );
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") throw new HttpError(400, "Invalid request body");
  const { purpose } = body as Record<string, unknown>;
  if (!isUploadPurpose(purpose)) {
    return NextResponse.json({ error: "Invalid upload purpose" }, { status: 400 });
  }

  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  const uploadPreset = presetFor(purpose);
  if (!cloudName || !apiKey || !apiSecret || !uploadPreset) {
    return NextResponse.json({ error: "Upload service unavailable" }, { status: 503 });
  }
  // Applications refer to an upload by its storage id plus a proof that this
  // server issued it; without the proof secret no upload could be used.
  const referenceSecret = process.env.INTERNAL_API_SECRET;
  if (!referenceSecret) {
    return NextResponse.json({ error: "Upload service unavailable" }, { status: 503 });
  }

  try {
    const signed = signUploadForPurpose(purpose, apiSecret, uploadPreset);
    const storageId = storageIdOf(signed);
    return NextResponse.json({
      cloudName,
      apiKey,
      resourceType: signed.resourceType,
      timestamp: signed.params.timestamp,
      folder: signed.params.folder,
      allowedFormats: signed.params.allowed_formats,
      publicId: signed.params.public_id,
      overwrite: signed.params.overwrite,
      uploadPreset: signed.params.upload_preset,
      deliveryType: signed.params.type,
      reference: { storageId, proof: uploadReferenceProof(purpose, storageId, referenceSecret) },
      signature: signed.signature,
    });
  } catch (error) {
    console.error("cloudinary/sign-upload failed:", error instanceof Error ? error.name : "unknown");
    return NextResponse.json({ error: "Upload authorisation failed" }, { status: 500 });
  }
});
