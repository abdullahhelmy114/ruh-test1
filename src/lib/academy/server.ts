/**
 * Server wiring for the academy core.
 *
 * This is the only academy module that touches the real database client. The
 * domain, policy, permission, governance and repository modules stay pure and
 * are unit-tested with fakes; API routes and server components import the
 * ready-made services from here.
 */
import "server-only";
import { sql } from "@/lib/db/client";
import { readAcademyFlags } from "./infra/flags.ts";
import type { SqlExecutor, SqlRow } from "./infra/sql.ts";
import { createPolicyService } from "./services/policy-service.ts";

export const academyExecutor: SqlExecutor = {
  async query<T extends SqlRow = SqlRow>(query: { readonly text: string; readonly values: readonly unknown[] }) {
    return (await sql.query(query.text, [...query.values])) as T[];
  },
  async transaction(queries) {
    return (await sql.transaction(queries.map((query) => sql.query(query.text, [...query.values])))) as SqlRow[][];
  },
};

export const academyFlags = readAcademyFlags(process.env);

export const policyService = createPolicyService({ executor: academyExecutor, flags: academyFlags });
