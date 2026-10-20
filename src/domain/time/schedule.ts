import { historyRetentionDays, historyRetentionRows } from "./limits";

export type InternalStatus =
  | "pending"
  | "due"
  | "missed"
  | "snoozed"
  | "dismissed"
  | "completed"
  | "cancelled";
export type NativeAttempt = "not_started" | "started" | "not_attempted";
export type NativeApiStatus =
  | "accepted"
  | "rejected"
  | "denied"
  | "unavailable"
  | "quiet_suppressed"
  | "uncertain";
export type NotificationRow = {
  idempotencyKey: string;
  ownerId: string;
  ruleId: string;
  occurrenceKey: string;
  fireAtUTC: number;
  internalStatus: InternalStatus;
  read: boolean;
  seenMissed: boolean;
  nativeAttempt: NativeAttempt;
  nativeApiStatus: NativeApiStatus | null;
  osDisplay: "unobserved";
  attempt: number;
  quietHoursOverride: boolean;
  sourceKind: "event" | "task" | "habit";
  title: string;
};

export function idempotencyKey(input: {
  ownerId: string;
  ruleId: string;
  occurrenceKey: string;
  scheduledInstant: number;
  attempt: number;
}) {
  return `${input.ownerId}:${input.ruleId}:${input.occurrenceKey}:${input.scheduledInstant}:${input.attempt}`;
}

export function reconcileRow(
  row: NotificationRow,
  now: number,
  browserQuit: boolean,
): NotificationRow {
  if (
    browserQuit &&
    row.internalStatus === "pending" &&
    row.fireAtUTC <= now &&
    row.nativeAttempt !== "started"
  ) {
    return { ...row, internalStatus: "missed", osDisplay: "unobserved" };
  }
  if (
    row.nativeAttempt === "started" &&
    row.nativeApiStatus === null &&
    (row.internalStatus === "due" || row.internalStatus === "pending")
  ) {
    return {
      ...row,
      internalStatus: "due",
      nativeApiStatus: "uncertain",
      osDisplay: "unobserved",
    };
  }
  if (
    !browserQuit &&
    row.internalStatus === "pending" &&
    row.fireAtUTC <= now &&
    row.nativeAttempt === "not_started"
  ) {
    return { ...row, internalStatus: "due", osDisplay: "unobserved" };
  }
  return row;
}

export function markAttemptStarted(
  row: NotificationRow,
): NotificationRow | null {
  if (row.internalStatus !== "due" || row.nativeAttempt !== "not_started")
    return null;
  if (row.nativeApiStatus !== null) return null;
  return { ...row, nativeAttempt: "started", osDisplay: "unobserved" };
}

export function applyDeliveryDecision(
  row: NotificationRow,
  decision:
    | { kind: "quiet" }
    | { kind: "permission"; status: "denied" | "unavailable" }
    | { kind: "api"; status: "accepted" | "rejected" },
): NotificationRow {
  if (decision.kind === "quiet") {
    return {
      ...row,
      nativeAttempt: "not_attempted",
      nativeApiStatus: "quiet_suppressed",
      osDisplay: "unobserved",
    };
  }
  if (decision.kind === "permission") {
    return {
      ...row,
      nativeAttempt: "not_attempted",
      nativeApiStatus: decision.status,
      osDisplay: "unobserved",
    };
  }
  return {
    ...row,
    nativeAttempt: "started",
    nativeApiStatus: decision.status,
    osDisplay: "unobserved",
  };
}

export function snoozeRow(
  row: NotificationRow,
  until: number,
): NotificationRow {
  return {
    ...idempotentChild(row, until),
    internalStatus: "pending",
    nativeAttempt: "not_started",
    nativeApiStatus: null,
  };
}

function idempotentChild(
  row: NotificationRow,
  fireAtUTC: number,
): NotificationRow {
  const attempt = row.attempt + 1;
  return {
    ...row,
    attempt,
    fireAtUTC,
    read: false,
    seenMissed: false,
    osDisplay: "unobserved",
    idempotencyKey: idempotencyKey({
      ownerId: row.ownerId,
      ruleId: row.ruleId,
      occurrenceKey: row.occurrenceKey,
      scheduledInstant: fireAtUTC,
      attempt,
    }),
  };
}

export function pruneHistory(
  rows: NotificationRow[],
  now: number,
  retentionDays = historyRetentionDays,
  retentionRows = historyRetentionRows,
) {
  const cutoff = now - retentionDays * 86_400_000;
  const eligible = rows
    .filter((row) => isEligibleHistory(row) && row.fireAtUTC >= cutoff)
    .sort((left, right) => left.fireAtUTC - right.fireAtUTC);
  const kept =
    eligible.length > retentionRows
      ? eligible.slice(eligible.length - retentionRows)
      : eligible;
  const keepIds = new Set(kept.map((row) => row.idempotencyKey));
  return rows.filter(
    (row) => !isEligibleHistory(row) || keepIds.has(row.idempotencyKey),
  );
}

function isEligibleHistory(row: NotificationRow) {
  if (row.internalStatus === "dismissed" || row.internalStatus === "completed")
    return true;
  if (row.internalStatus === "cancelled") return true;
  return row.internalStatus === "missed" && row.seenMissed;
}

export function quietHoursActive(
  nowMs: number,
  quiet: { enabled: boolean; start: string; end: string; timeZone: string },
  zonedMinutes: (epochMs: number, timeZone: string) => number,
) {
  if (!quiet.enabled) return false;
  const minute = zonedMinutes(nowMs, quiet.timeZone);
  const start = clockMinutes(quiet.start);
  const end = clockMinutes(quiet.end);
  if (start === end) return true;
  if (start < end) return minute >= start && minute < end;
  return minute >= start || minute < end;
}

function clockMinutes(value: string) {
  const [hourText, minuteText] = value.split(":");
  return Number(hourText) * 60 + Number(minuteText);
}
