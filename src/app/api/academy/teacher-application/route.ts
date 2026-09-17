import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { HttpError } from "@/lib/auth/core";
import { withApi } from "@/lib/api/handler";
import { PRIVATE_NO_STORE, readCorrelationId, readJsonObject } from "@/lib/academy/http";
import { teacherService } from "@/lib/academy/server";
import { verifyUploadReference } from "@/lib/security/cloudinary-sign";
import type { UploadPurpose } from "@/lib/security/upload-purpose";

// The signed-in teacher account's own application: its status (GET), a first
// submission for an account created before applications were recorded (POST),
// and a revision after an administrator requested changes (PATCH). The
// account is always the session's; documents must carry this server's upload
// proof and are stored by private upload id only.

function uploadReference(purpose: UploadPurpose, value: unknown, required: boolean): string | null {
  if (value === undefined || value === null) {
    if (required) throw new HttpError(400, purpose === "teacher_cv" ? "Upload your CV (PDF)." : "Upload your introduction video again.");
    return null;
  }
  const secret = process.env.INTERNAL_API_SECRET;
  if (!secret) throw new HttpError(503, "Uploads are not available right now.");
  const storageId = verifyUploadReference(purpose, value, secret);
  if (!storageId) throw new HttpError(400, purpose === "teacher_cv" ? "Upload your CV (PDF) again." : "Upload your introduction video again.");
  return storageId;
}

export const GET = withApi(async (req) => {
  const user = await requireAuth(req);
  return NextResponse.json({ data: await teacherService.myApplication(user) }, { headers: PRIVATE_NO_STORE });
});

export const POST = withApi(async (req) => {
  const user = await requireAuth(req);
  const body = await readJsonObject(req);
  const data = await teacherService.submitApplication(user, {
    details: body.details,
    cvPublicId: uploadReference("teacher_cv", body.cv, true),
    introVideoPublicId: uploadReference("teacher_intro_video", body.introVideo, false),
    correlationId: readCorrelationId(req),
  });
  return NextResponse.json({ data }, { status: 201, headers: PRIVATE_NO_STORE });
});

export const PATCH = withApi(async (req) => {
  const user = await requireAuth(req);
  const body = await readJsonObject(req);
  const data = await teacherService.resubmitApplication(user, {
    details: body.details,
    cvPublicId: uploadReference("teacher_cv", body.cv, false),
    introVideoPublicId: uploadReference("teacher_intro_video", body.introVideo, false),
    expectedRevision: body.expectedRevision,
    correlationId: readCorrelationId(req),
  });
  return NextResponse.json({ data }, { headers: PRIVATE_NO_STORE });
});
