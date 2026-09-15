// Containment: obsolete duplicate of POST /api/send-verification-code, published
// by accident. It emailed a plaintext code to any caller-supplied address with no
// authentication or rate limit, targeted verification_codes columns (email, code)
// that do not exist in the live table, and bypassed the per-user HMAC OTP flow in
// src/lib/security/otp.ts. It was never called by the app. Disabled; the real
// resend route is the only verification-code sender. No imports, so no email or
// database code can run.
export async function POST() {
  return Response.json(
    { error: "This endpoint has been removed." },
    { status: 410 }
  );
}
