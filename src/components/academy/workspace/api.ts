"use client";

import { useCallback, useEffect, useState } from "react";
import { authFetch } from "@/lib/authFetch";
import { useAuth } from "@/lib/firebase/AuthProvider";
import { NETWORK_FAILURE, dataOf, failureFromResponse, type ApiFailure } from "@/lib/academy/workspace/api-errors";

/**
 * Data access for the workspace screens. Every call goes to the academy API
 * with the signed-in user's token; the server decides what the caller may see
 * or do. Nothing here caches responses.
 */

export type ApiResult<T> = { readonly ok: true; readonly data: T } | { readonly ok: false; readonly failure: ApiFailure };

export type ApiState<T> =
  | { readonly status: "loading" }
  | { readonly status: "ready"; readonly data: T }
  | { readonly status: "failed"; readonly failure: ApiFailure };

const UNAUTHENTICATED: ApiFailure = Object.freeze({ kind: "unauthenticated", status: 401, message: null });

/**
 * Read-through cache for GET screens: a recent response paints immediately
 * (no skeleton, no layout jump) while the request still runs and replaces it.
 * Purely a presentation optimization — every navigation still revalidates
 * against the same API, and entries are scoped to the signed-in user.
 */
const FRESH_MS = 30_000;
const readCache = new Map<string, { readonly data: unknown; readonly at: number }>();

function cacheKey(uid: string, url: string): string {
  return `${uid}|${url}`;
}

export async function requestJson<T>(
  url: string,
  init: { readonly method?: string; readonly body?: unknown; readonly select?: (body: unknown) => T } = {},
): Promise<ApiResult<T>> {
  let response: Response;
  try {
    response = await authFetch(url, {
      method: init.method ?? "GET",
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      cache: "no-store",
    });
  } catch {
    return { ok: false, failure: NETWORK_FAILURE };
  }
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) return { ok: false, failure: failureFromResponse(response.status, body) };
  try {
    return { ok: true, data: init.select ? init.select(body) : dataOf<T>(body) };
  } catch {
    return { ok: false, failure: failureFromResponse(500, null) };
  }
}

/**
 * Loads a resource once auth is known; `url === null` waits (for example until
 * a choice is made). `select` reads responses that are not `{ data }` shaped.
 */
export function useApi<T>(url: string | null, select?: (body: unknown) => T): { readonly state: ApiState<T>; readonly reload: () => void } {
  const { user, isLoading } = useAuth();
  const [state, setState] = useState<ApiState<T>>({ status: "loading" });
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      setState({ status: "failed", failure: UNAUTHENTICATED });
      return;
    }
    if (url === null) return;
    let cancelled = false;
    // Keep showing loaded data while refreshing; show loading only the first time.
    const cached = readCache.get(cacheKey(user.uid, url));
    if (cached && Date.now() - cached.at < FRESH_MS && nonce === 0) {
      setState({ status: "ready", data: cached.data as T });
    } else {
      setState((previous) => (previous.status === "ready" ? previous : { status: "loading" }));
    }
    requestJson<T>(url, { select }).then((result) => {
      if (result.ok) {
        if (readCache.size > 200) readCache.clear();
        readCache.set(cacheKey(user.uid, url), { data: result.data, at: Date.now() });
      }
      if (cancelled) return;
      setState(result.ok ? { status: "ready", data: result.data } : { status: "failed", failure: result.failure });
    });
    return () => {
      cancelled = true;
    };
  }, [url, user, isLoading, nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  return { state, reload };
}

/**
 * Loads one resource per class group incrementally: each group's slot fills
 * as its own request settles, so one slow group never blanks the others.
 * `url` and `select` must be stable (module-level) helpers.
 */
export function usePerGroup<T>(
  classGroupIds: readonly string[],
  url: (id: string) => string,
  select: (data: unknown) => T,
): ReadonlyMap<string, T> {
  const { user, isLoading } = useAuth();
  const [map, setMap] = useState<ReadonlyMap<string, T>>(new Map());
  const key = classGroupIds.join("|");
  useEffect(() => {
    if (isLoading || !user || key === "") return;
    let cancelled = false;
    for (const id of key.split("|")) {
      requestJson<unknown>(url(id)).then((result) => {
        if (cancelled || !result.ok) return;
        setMap((previous) => new Map(previous).set(id, select(result.data)));
      });
    }
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, user, isLoading]);
  return map;
}

/** A write with a busy flag and the last failure, for forms and command buttons. */
export function useAction() {
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<ApiFailure | null>(null);

  const run = useCallback(async <T,>(url: string, method: "POST" | "PUT" | "PATCH" | "DELETE", body?: unknown): Promise<ApiResult<T>> => {
    setBusy(true);
    setFailure(null);
    const result = await requestJson<T>(url, { method, body });
    setBusy(false);
    if (!result.ok) setFailure(result.failure);
    return result;
  }, []);

  const clear = useCallback(() => setFailure(null), []);
  return { busy, failure, run, clear };
}
