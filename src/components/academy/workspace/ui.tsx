"use client";

import Link from "next/link";
import {
  forwardRef,
  useEffect,
  useId,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type KeyboardEvent,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import type { ApiFailure } from "@/lib/academy/workspace/api-errors";
import { cn } from "@/lib/utils";
import type { ApiState } from "./api";
import { useWorkspace } from "./context";
import { useIsWide } from "./use-is-wide";

/*
 * Functional building blocks for the academy workspace. Theme tokens only
 * (dark mode), logical properties only (RTL), visible focus, labelled
 * controls and inline forms instead of modal dialogs. Visual design is
 * deliberately plain; art direction comes later.
 */

const FOCUS = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

export function PageHeader({
  title,
  intro,
  back,
  actions,
}: {
  readonly title: ReactNode;
  readonly intro?: ReactNode;
  readonly back?: { readonly href: string; readonly label: string };
  readonly actions?: ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {back && (
          <p className="mb-2 text-sm">
            <Link href={back.href} className={cn("underline-offset-4 hover:underline", FOCUS, "rounded-sm")}>
              <span aria-hidden="true" className="rtl:hidden">← </span>
              <span aria-hidden="true" className="ltr:hidden">→ </span>
              {back.label}
            </Link>
          </p>
        )}
        <h1 className="break-words font-serif text-3xl sm:text-4xl">{title}</h1>
        {intro && <p className="mt-1.5 text-muted-foreground">{intro}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
  );
}

export function Section({
  title,
  actions,
  children,
  className,
}: {
  readonly title: ReactNode;
  readonly actions?: ReactNode;
  readonly children: ReactNode;
  readonly className?: string;
}) {
  const id = useId();
  return (
    <section aria-labelledby={id} className={cn("mb-8", className)}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 id={id} className="font-serif text-xl">{title}</h2>
        {actions}
      </div>
      {children}
    </section>
  );
}

export function Card({ children, className }: { readonly children: ReactNode; readonly className?: string }) {
  return <div className={cn("rounded-2xl border bg-card p-5 text-card-foreground", className)}>{children}</div>;
}

export function Loading({ shape = "bars" }: { readonly shape?: "bars" | "list" | "cards" } = {}) {
  const { t } = useWorkspace();
  const pulse = "animate-pulse rounded bg-muted motion-reduce:animate-none";
  return (
    <div role="status" aria-live="polite" className="py-2">
      <span className="sr-only">{t.common.loading}</span>
      {shape === "list" && (
        <div aria-hidden="true" className="divide-y rounded-2xl border">
          {[0, 1, 2].map((row) => (
            <div key={row} className="flex items-center gap-3 p-3">
              <div className={cn("size-10 shrink-0 rounded-full", pulse)} />
              <div className="min-w-0 flex-1 space-y-2">
                <div className={cn("h-3.5 w-1/3", pulse)} />
                <div className={cn("h-3 w-2/3", pulse)} />
              </div>
            </div>
          ))}
        </div>
      )}
      {shape === "cards" && (
        <div aria-hidden="true" className="space-y-4">
          <div className={cn("min-h-32 rounded-2xl border", pulse)} />
          <div className={cn("min-h-32 rounded-2xl border", pulse)} />
        </div>
      )}
      {shape === "bars" && (
        <div aria-hidden="true" className="space-y-2">
          <div className={cn("h-4 w-2/3", pulse)} />
          <div className={cn("h-4 w-1/2", pulse)} />
          <div className={cn("h-4 w-3/5", pulse)} />
        </div>
      )}
    </div>
  );
}

export function failureText(t: ReturnType<typeof useWorkspace>["t"], failure: ApiFailure): string {
  switch (failure.kind) {
    case "unauthenticated":
      return t.states.signInRequired;
    case "forbidden":
      return t.states.forbidden;
    case "not_yet":
      return t.states.notYet;
    case "not_found":
      return t.states.notFound;
    case "conflict":
      return t.states.conflict;
    case "invalid":
      return t.states.invalid;
    case "rate_limited":
      return t.states.rateLimited;
    case "unavailable":
      return t.states.unavailable;
    case "network":
      return t.states.network;
    case "server":
      return t.states.server;
  }
}

/** Explains a failed request. Validation details from the server are shown as sent (they are written for end users). */
export function FailureNotice({ failure, onRetry }: { readonly failure: ApiFailure; readonly onRetry?: () => void }) {
  const { t } = useWorkspace();
  const detail = (failure.kind === "invalid" || failure.kind === "conflict") && failure.message ? failure.message : null;
  return (
    <div role="alert" className="rounded-xl border border-destructive/40 bg-destructive/5 p-4">
      <p className="font-medium">{failureText(t, failure)}</p>
      {detail && <p className="mt-1 text-sm text-muted-foreground">{detail}</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        {failure.kind === "unauthenticated" && (
          <Link href="/login" className={cn("rounded-lg bg-primary px-3 py-1.5 text-sm text-primary-foreground", FOCUS)}>
            {t.states.signIn}
          </Link>
        )}
        {onRetry && (failure.kind === "network" || failure.kind === "server" || failure.kind === "rate_limited" || failure.kind === "conflict") && (
          <Button type="button" variant="outline" onClick={onRetry}>
            {t.common.retry}
          </Button>
        )}
      </div>
    </div>
  );
}

/** Renders loading, failure or the loaded data. */
export function ApiView<T>({
  state,
  onRetry,
  children,
  notYet,
  loading,
}: {
  readonly state: ApiState<T>;
  readonly onRetry?: () => void;
  readonly children: (data: T) => ReactNode;
  /** Replaces the generic "not yet" text, for time-gated content. */
  readonly notYet?: ReactNode;
  /** A geometry-matched skeleton so first paint reserves the real layout. */
  readonly loading?: ReactNode;
}) {
  if (state.status === "loading") return <>{loading ?? <Loading />}</>;
  if (state.status === "failed") {
    if (state.failure.kind === "not_yet" && notYet) return <Notice>{notYet}</Notice>;
    return <FailureNotice failure={state.failure} onRetry={onRetry} />;
  }
  return <>{children(state.data)}</>;
}

export function Notice({ children, tone = "info" }: { readonly children: ReactNode; readonly tone?: "info" | "success" | "warning" }) {
  return (
    <p
      role="status"
      className={cn(
        "rounded-xl border p-3 text-sm",
        tone === "success" && "border-primary/40 bg-primary/5",
        tone === "warning" && "border-destructive/40 bg-destructive/5",
        tone === "info" && "bg-muted/40",
      )}
    >
      {children}
    </p>
  );
}

export function EmptyState({ children, icon, action }: { readonly children: ReactNode; readonly icon?: ReactNode; readonly action?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed p-8 text-center">
      {icon && (
        <div aria-hidden="true" className="mx-auto mb-3 grid size-10 place-items-center rounded-full bg-muted text-muted-foreground">
          {icon}
        </div>
      )}
      <p className="text-sm text-muted-foreground">{children}</p>
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

export function Badge({ children, tone = "neutral" }: { readonly children: ReactNode; readonly tone?: "neutral" | "strong" | "warning" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium",
        tone === "neutral" && "bg-muted text-foreground",
        tone === "strong" && "border-primary bg-primary text-primary-foreground",
        tone === "warning" && "border-destructive/50 text-destructive",
      )}
    >
      {children}
    </span>
  );
}

export const Button = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & {
    readonly variant?: "primary" | "outline" | "ghost" | "danger";
    readonly size?: "sm" | "md";
    readonly busy?: boolean;
  }
>(function Button({ variant = "primary", size = "md", busy = false, className, children, disabled, ...props }, ref) {
  return (
    <button
      {...props}
      ref={ref}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      className={cn(
        "inline-flex min-h-9 items-center justify-center gap-2 rounded-lg border text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60",
        FOCUS,
        size === "sm" ? "px-2.5 py-1" : "px-4 py-2",
        variant === "primary" && "border-primary bg-primary text-primary-foreground hover:bg-primary/90",
        variant === "outline" && "bg-background hover:bg-accent hover:text-accent-foreground",
        variant === "ghost" && "border-transparent hover:bg-accent hover:text-accent-foreground",
        variant === "danger" && "border-destructive text-destructive hover:bg-destructive/10",
        className,
      )}
    >
      {children}
    </button>
  );
});

export function LinkButton({ href, children, variant = "outline", external = false }: { readonly href: string; readonly children: ReactNode; readonly variant?: "primary" | "outline"; readonly external?: boolean }) {
  const className = cn(
    "inline-flex min-h-9 items-center justify-center rounded-lg border px-3 py-1.5 text-sm font-medium",
    FOCUS,
    variant === "primary" ? "border-primary bg-primary text-primary-foreground hover:bg-primary/90" : "bg-background hover:bg-accent hover:text-accent-foreground",
  );
  if (external) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}

export function TextLink({ href, children }: { readonly href: string; readonly children: ReactNode }) {
  return (
    <Link href={href} className={cn("font-medium underline underline-offset-4 hover:no-underline", FOCUS, "rounded-sm")}>
      {children}
    </Link>
  );
}

const CONTROL = cn("w-full rounded-lg border border-input bg-background px-3 py-2 text-sm", FOCUS);

export function Field({
  label,
  hint,
  children,
  htmlFor,
  optional,
}: {
  readonly label: ReactNode;
  readonly hint?: ReactNode;
  readonly children: ReactNode;
  readonly htmlFor: string;
  readonly optional?: boolean;
}) {
  const { t } = useWorkspace();
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={htmlFor} className="text-sm font-medium">
        {label}
        {optional && <span className="ms-1 font-normal text-muted-foreground">({t.common.optional})</span>}
      </label>
      {children}
      {hint && <p id={`${htmlFor}-hint`} className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn(CONTROL, props.className)} />;
}

export function TextArea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea rows={4} {...props} className={cn(CONTROL, "min-h-24", props.className)} />;
}

export function SelectInput(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cn(CONTROL, props.className)} />;
}

/** A reason field for audited actions. */
export function ReasonField({ id, value, onChange, required = true }: { readonly id: string; readonly value: string; readonly onChange: (value: string) => void; readonly required?: boolean }) {
  const { t } = useWorkspace();
  return (
    <Field label={t.common.reason} htmlFor={id} hint={t.common.reasonHint} optional={!required}>
      <TextArea id={id} value={value} required={required} maxLength={2000} rows={2} aria-describedby={`${id}-hint`} onChange={(e) => onChange(e.target.value)} />
    </Field>
  );
}

export interface TabItem<K extends string> {
  readonly key: K;
  readonly label: string;
}

/** An accessible tab list (arrow keys, Home and End move between tabs). */
export function Tabs<K extends string>({ tabs, current, onChange, label }: { readonly tabs: readonly TabItem<K>[]; readonly current: K; readonly onChange: (key: K) => void; readonly label: string }) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const { dir } = useWorkspace();
  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const forward = dir === "rtl" ? "ArrowLeft" : "ArrowRight";
    const backward = dir === "rtl" ? "ArrowRight" : "ArrowLeft";
    let next = -1;
    if (event.key === forward) next = (index + 1) % tabs.length;
    else if (event.key === backward) next = (index - 1 + tabs.length) % tabs.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = tabs.length - 1;
    if (next < 0) return;
    event.preventDefault();
    refs.current[next]?.focus();
    onChange(tabs[next].key);
  }
  return (
    <div role="tablist" aria-label={label} className="-mx-4 mb-6 flex gap-1 overflow-x-auto border-b px-4 sm:mx-0 sm:px-0">
      {tabs.map((tab, index) => {
        const selected = tab.key === current;
        return (
          <button
            key={tab.key}
            ref={(element) => {
              refs.current[index] = element;
            }}
            id={`tab-${tab.key}`}
            role="tab"
            type="button"
            aria-selected={selected}
            aria-controls={selected ? `panel-${tab.key}` : undefined}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(tab.key)}
            onKeyDown={(event) => onKeyDown(event, index)}
            className={cn(
              "shrink-0 whitespace-nowrap border-b-2 px-3 py-2 text-sm",
              FOCUS,
              selected ? "border-primary font-semibold" : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

export function TabPanel({ tabKey, children }: { readonly tabKey: string; readonly children: ReactNode }) {
  return (
    <div role="tabpanel" id={`panel-${tabKey}`} aria-labelledby={`tab-${tabKey}`} tabIndex={0} className={cn("rounded-sm", FOCUS)}>
      {children}
    </div>
  );
}

export interface Column<R> {
  readonly key: string;
  readonly header: ReactNode;
  readonly cell: (row: R) => ReactNode;
}

/** A table on wide screens and a list of labelled cards on narrow ones. */
export function DataTable<R>({ columns, rows, rowKey, caption, empty }: { readonly columns: readonly Column<R>[]; readonly rows: readonly R[]; readonly rowKey: (row: R) => string; readonly caption: string; readonly empty: ReactNode }) {
  const wide = useIsWide();
  if (rows.length === 0) return <EmptyState>{empty}</EmptyState>;
  if (!wide)
    return (
      <ul className="space-y-3" aria-label={caption}>
        {rows.map((row) => (
          <li key={rowKey(row)} className="rounded-xl border p-3">
            <dl className="grid grid-cols-[minmax(0,40%)_1fr] gap-x-3 gap-y-1 text-sm">
              {columns.map((column) => (
                <div key={column.key} className="contents">
                  <dt className="text-muted-foreground">{column.header}</dt>
                  <dd className="min-w-0 break-words">{column.cell(row)}</dd>
                </div>
              ))}
            </dl>
          </li>
        ))}
      </ul>
    );
  return (
    <>
      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full text-sm">
          <caption className="sr-only">{caption}</caption>
          <thead className="bg-muted/40 text-xs uppercase tracking-wide rtl:tracking-normal text-muted-foreground">
            <tr>
              {columns.map((column) => (
                <th key={column.key} scope="col" className="px-3 py-2 text-start font-medium">
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={rowKey(row)} className="border-t align-top transition-colors hover:bg-muted/20">
                {columns.map((column) => (
                  <td key={column.key} className="px-3 py-2">
                    {column.cell(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

export function KeyValues({ items }: { readonly items: readonly { readonly label: ReactNode; readonly value: ReactNode }[] }) {
  return (
    <dl className="grid grid-cols-[minmax(0,auto)_1fr] gap-x-4 gap-y-1 text-sm">
      {items.map((item, index) => (
        <div key={index} className="contents">
          <dt className="text-muted-foreground">{item.label}</dt>
          <dd className="min-w-0 break-words">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** A destructive or irreversible command that asks for confirmation in place (no modal). */
export function ConfirmButton({
  label,
  confirmLabel,
  onConfirm,
  busy,
  variant = "danger",
}: {
  readonly label: string;
  readonly confirmLabel: string;
  readonly onConfirm: () => void;
  readonly busy?: boolean;
  readonly variant?: "danger" | "primary" | "outline";
}) {
  const { t } = useWorkspace();
  const [asking, setAsking] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  // Keyboard focus follows the trigger/confirm swap instead of falling to body
  // (skipping mount, so the page never steals focus on first render).
  const mounted = useRef(false);
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    (asking ? confirmRef : triggerRef).current?.focus();
  }, [asking]);
  if (!asking) {
    return (
      <Button ref={triggerRef} type="button" variant={variant} size="sm" onClick={() => setAsking(true)}>
        {label}
      </Button>
    );
  }
  return (
    <span className="inline-flex flex-wrap items-center gap-2" role="group" aria-label={confirmLabel}>
      <span className="text-sm">{confirmLabel}</span>
      <Button
        ref={confirmRef}
        type="button"
        variant={variant}
        size="sm"
        busy={busy}
        onClick={() => {
          setAsking(false);
          onConfirm();
        }}
      >
        {t.common.confirm}
      </Button>
      <Button type="button" variant="ghost" size="sm" onClick={() => setAsking(false)}>
        {t.common.cancel}
      </Button>
    </span>
  );
}

/** Shows a short success message after a write. */
export function useFlash(): [string | null, (message: string | null) => void] {
  const [message, setMessage] = useState<string | null>(null);
  return [message, setMessage];
}
