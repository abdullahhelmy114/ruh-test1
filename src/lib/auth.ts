/**
 * Public entry point for server-side authentication and authorization.
 *
 *   import { requireAdmin, requireAuth, getSession } from "@/lib/auth";
 *
 * Note: TypeScript resolves "@/lib/auth" to this file (a file wins over the
 * ./auth/ directory), so this barrel re-exports the wired service from
 * ./auth/index.ts. `getServerSession` is kept as an alias for existing
 * importers; new code should use `getSession` / `require*`.
 */
export * from "./auth/index";
