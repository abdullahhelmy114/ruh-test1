/**
 * `withApi` — thin wrapper for App Router route handlers.
 *
 * - Converts `AuthError` into a clean 401/403 JSON response.
 * - Converts any other thrown error into a generic 500 (never leaks
 *   `error.message`, stack traces, or database details to the client).
 * - Preserves Next.js 16's `{ params: Promise<...> }` context untouched.
 *
 * Usage:
 *
 *   export const GET = withApi(async (req) => {
 *     const user = await requireAdmin(req);
 *     return NextResponse.json({ ... });
 *   });
 */
import { NextResponse } from "next/server";
import { toErrorResponse } from "@/lib/auth/core";

export type RouteParams = Record<string, string | string[]>;

export type RouteContext<P extends RouteParams = RouteParams> = {
  params: Promise<P>;
};

export type ApiHandler<P extends RouteParams = RouteParams> = (
  req: Request,
  ctx: RouteContext<P>
) => Promise<Response> | Response;

export function withApi<P extends RouteParams = RouteParams>(
  handler: ApiHandler<P>
): ApiHandler<P> {
  return async (req, ctx) => {
    try {
      return await handler(req, ctx);
    } catch (error) {
      const { status, body } = toErrorResponse(error);
      if (status === 500) {
        console.error(
          `[api] ${req.method} ${new URL(req.url).pathname} failed:`,
          error
        );
      }
      return NextResponse.json(body, { status });
    }
  };
}
