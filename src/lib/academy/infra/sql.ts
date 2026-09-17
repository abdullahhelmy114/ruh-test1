/**
 * Minimal SQL abstraction for the academy core.
 *
 * Repositories build parameterised `SqlQuery` values; they never interpolate
 * data into SQL text. An `SqlExecutor` runs them. The production executor
 * (server.ts) delegates to the shared Neon client; tests supply a recording
 * fake, so repository behaviour is verified without any database.
 */

export interface SqlQuery {
  readonly text: string;
  readonly values: readonly unknown[];
}

export type SqlRow = Record<string, unknown>;

export interface SqlExecutor {
  query<T extends SqlRow = SqlRow>(query: SqlQuery): Promise<T[]>;
  /** Runs the queries atomically, in order, as one database transaction. */
  transaction(queries: readonly SqlQuery[]): Promise<SqlRow[][]>;
}

/**
 * Tagged template that turns interpolations into $1..$n placeholders.
 *
 *   sqlQuery`SELECT * FROM t WHERE id = ${id}` -> { text: "SELECT * FROM t WHERE id = $1", values: [id] }
 */
export function sqlQuery(strings: TemplateStringsArray, ...values: unknown[]): SqlQuery {
  let text = strings[0];
  for (let i = 0; i < values.length; i++) {
    text += `$${i + 1}${strings[i + 1]}`;
  }
  return Object.freeze({ text, values: Object.freeze([...values]) });
}

/** Encodes a value for a `::jsonb` parameter. */
export function jsonParam(value: unknown): string {
  return JSON.stringify(value ?? null);
}

/** Shifts every $n placeholder in `text` by `offset`. Only for generated SQL. */
export function shiftPlaceholders(text: string, offset: number): string {
  if (offset === 0) return text;
  return text.replace(/\$(\d+)\b/g, (_match, n: string) => `$${Number(n) + offset}`);
}

/**
 * Joins generated fragments into one query, renumbering placeholders so the
 * values of each fragment line up. Fragments must not contain string literals
 * with `$` digits (the academy repositories never generate such text).
 */
export function joinQueries(parts: readonly SqlQuery[], separator = " "): SqlQuery {
  const texts: string[] = [];
  const values: unknown[] = [];
  for (const part of parts) {
    texts.push(shiftPlaceholders(part.text, values.length));
    values.push(...part.values);
  }
  return Object.freeze({ text: texts.join(separator), values: Object.freeze(values) });
}

/** Postgres unique-violation detection without importing driver types. */
export function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { code?: unknown }).code === "23505";
}

/** Postgres foreign-key violation (a referenced row does not exist). */
export function isForeignKeyViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { code?: unknown }).code === "23503";
}

/**
 * SQLSTATE raised by `academy_expect_rows` (migration 0002) when a guarded
 * write matched an unexpected number of rows. Raising inside a transaction
 * rolls back every statement in it.
 */
export const STALE_WRITE_SQLSTATE = "RQ409";

export function isStaleWrite(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { code?: unknown }).code === STALE_WRITE_SQLSTATE;
}
