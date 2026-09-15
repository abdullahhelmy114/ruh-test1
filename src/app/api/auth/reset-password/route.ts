// Containment: this endpoint was published by accident. It accepted any
// caller-supplied email with no authentication, captcha or rate limit,
// generated a Firebase password-reset link, attempted to email it, and returned
// provider error messages (which can disclose whether an account exists). It
// was never called by the app: /forgot-password uses the Firebase client SDK
// directly. Disabled. No imports, so no email, Firebase or database code can run.
export async function POST() {
  return Response.json(
    { error: "This endpoint has been removed." },
    { status: 410 }
  );
}
