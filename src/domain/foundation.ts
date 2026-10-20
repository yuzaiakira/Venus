import { z } from "zod";
export const schemaVersion = 1;
export const ProbeSchema = z
  .object({
    id: z.string().uuid(),
    dueAt: z.number().finite().nonnegative(),
    state: z.enum(["pending", "due", "missed"]),
    native: z.enum(["not_attempted", "api_accepted", "blocked", "failed"]),
  })
  .strict();
export type Probe = z.infer<typeof ProbeSchema>;
export type ErrorCode =
  | "permissionDenied"
  | "platformUnavailable"
  | "invalidInput"
  | "storageError"
  | "unexpected";
export type Result<T> = { ok: true; value: T } | { ok: false; code: ErrorCode };
export interface AlarmPort {
  schedule(id: string, at: number): Promise<void>;
  list(): Promise<string[]>;
}
export interface NotificationPort {
  show(id: string): Promise<Probe["native"]>;
}
export interface BookmarkPort {
  hasPermission(): Promise<boolean>;
  probe(): Promise<void>;
}
export interface PreferencePort {
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown): Promise<void>;
}
export interface DomainEvent {
  type: "probe.changed";
  id: string;
  revision: number;
}
export interface ProbeSessionPort {
  active(): Promise<boolean>;
  begin(): Promise<void>;
}
export function safeUrl(raw: string): string {
  const url = new URL(raw);
  if (!["https:", "http:"].includes(url.protocol))
    throw new Error("invalidInput");
  return url.href;
}
export function reconcile(probe: Probe, now: number): Probe {
  return probe.state === "pending" && probe.dueAt < now
    ? { ...probe, state: "missed" }
    : probe;
}
// Deliberately omit raw error messages, URLs, file paths and user content.
export function diagnostic(code: ErrorCode, at = Date.now()) {
  return { code, at };
}
