// Retired. The session this route required only exists for accounts that
// already have a profile, so its insert never ran; it took the email from the
// request body. Nothing in the application called it. Accounts are created by
// the signup routes. No imports, so no database or Firebase code can run.
export async function POST() {
  return Response.json(
    { error: "This endpoint has been removed." },
    { status: 410 }
  );
}
