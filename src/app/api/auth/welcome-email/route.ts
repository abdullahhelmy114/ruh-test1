// Containment: this endpoint was published by accident. It sent a welcome email
// to any caller-supplied address and name with no authentication, captcha or
// rate limit (an open email relay under the academy's sender) and returned raw
// error messages. It was never called by the app. Disabled. No imports, so no
// email code can run.
export async function POST() {
  return Response.json(
    { error: "This endpoint has been removed." },
    { status: 410 }
  );
}
