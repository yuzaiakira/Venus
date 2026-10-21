import { z } from "zod";
import { addDays, assertProductDate, todayInZone } from "./time/calendar";

const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const timeString = z.string().regex(/^\d{2}:\d{2}$/);
const stampSchema = {
  id: z.string().uuid(),
  revision: z.number().int().min(1),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
};

export const inboxKinds = ["task", "note", "event"] as const;
export const inboxConfidence = ["high", "medium", "low"] as const;
export const inboxStatuses = [
  "pending",
  "accepted",
  "rejected",
  "undone",
] as const;

export const taskInboxDraftSchema = z
  .object({
    kind: z.literal("task"),
    title: z.string().min(1).max(300),
    details: z.string().max(100_000),
    today: z.boolean(),
    priority: z.union([z.literal(1), z.literal(2), z.literal(3)]),
    dueDate: dateString.nullable(),
  })
  .strict();
export const noteInboxDraftSchema = z
  .object({
    kind: z.literal("note"),
    title: z.string().min(1).max(300),
    content: z.string().max(100_000),
    tags: z.array(z.string().min(1).max(40)).max(16),
  })
  .strict();
export const eventInboxDraftSchema = z
  .object({
    kind: z.literal("event"),
    title: z.string().min(1).max(200),
    description: z.string().max(4_000),
    allDay: z.boolean(),
    date: dateString.nullable(),
    time: timeString.nullable(),
    timeZone: z.string().min(1),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.date) {
      const [year, month, day] = value.date.split("-").map(Number);
      try {
        assertProductDate({
          calendar: "gregorian",
          year: year!,
          month: month!,
          day: day!,
        });
      } catch {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["date"],
          message: "Invalid event date",
        });
      }
    }
    if (value.time) {
      const [hour, minute] = value.time.split(":").map(Number);
      if (hour! > 23 || minute! > 59)
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["time"],
          message: "Invalid event time",
        });
    }
    try {
      new Intl.DateTimeFormat("en", { timeZone: value.timeZone }).format(0);
    } catch {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["timeZone"],
        message: "Invalid event time zone",
      });
    }
  });

// The event branch has cross-field validation, which Zod represents as an
// effect; use a union so that validation remains intact for all draft kinds.
export const inboxDraftSchema = z.union([
  taskInboxDraftSchema,
  noteInboxDraftSchema,
  eventInboxDraftSchema,
]);
export const inboxSuggestionSchema = z
  .object({
    kind: z.enum(inboxKinds),
    confidence: z.enum(inboxConfidence),
    reason: z.enum([
      "action",
      "dateTime",
      "date",
      "informational",
      "ambiguous",
    ]),
  })
  .strict();
export const inboxDestinationSchema = z
  .object({
    kind: z.enum(inboxKinds),
    id: z.string().uuid(),
    revision: z.number().int().min(1).nullable(),
  })
  .strict();
export const inboxOperationSchema = z
  .object({
    id: z.string().uuid(),
    destinationId: z.string().uuid(),
    state: z.enum(["creating", "completed"]),
  })
  .strict()
  .nullable();

export const inboxItemSchema = z
  .object({
    ...stampSchema,
    profileId: z.string().uuid(),
    source: z.literal("manual"),
    content: z.string().min(1).max(100_000),
    suggestion: inboxSuggestionSchema,
    selectedKind: z.enum(inboxKinds),
    draft: inboxDraftSchema,
    status: z.enum(inboxStatuses),
    destination: inboxDestinationSchema.nullable(),
    operation: inboxOperationSchema,
    rejectedAt: z.string().nullable(),
    acceptedAt: z.string().nullable(),
    undoneAt: z.string().nullable(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.draft.kind !== value.selectedKind)
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["draft"],
        message: "Draft must match the selected destination",
      });
    if (value.status === "accepted" && !value.destination)
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["destination"],
        message: "Accepted inbox items need a destination",
      });
  });

export type InboxKind = (typeof inboxKinds)[number];
export type InboxConfidence = (typeof inboxConfidence)[number];
export type InboxStatus = (typeof inboxStatuses)[number];
export type InboxDraft = z.infer<typeof inboxDraftSchema>;
export type InboxItemRecord = z.infer<typeof inboxItemSchema>;

const persianDigits = "۰۱۲۳۴۵۶۷۸۹";
function latinDigits(value: string) {
  return value.replace(/[۰-۹]/g, (digit) =>
    String(persianDigits.indexOf(digit)),
  );
}
function compactTitle(content: string) {
  const first = content.split(/\n+/)[0]?.trim() || content.trim();
  return first.slice(0, 300);
}
function isoDate(date: { year: number; month: number; day: number }) {
  return `${date.year.toString().padStart(4, "0")}-${date.month
    .toString()
    .padStart(2, "0")}-${date.day.toString().padStart(2, "0")}`;
}

export function parsedInboxDate(
  content: string,
  timeZone: string,
  now = Date.now(),
) {
  const latin = latinDigits(content);
  const absolute = /\b(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?\b/.exec(
    latin,
  );
  if (absolute) {
    const date = `${absolute[1]}-${absolute[2]}-${absolute[3]}`;
    const time = absolute[4] ? `${absolute[4]}:${absolute[5]}` : null;
    return { date, time };
  }
  if (/\b(tomorrow)\b/i.test(latin) || /فردا/.test(content)) {
    const today = todayInZone(timeZone, now, "gregorian");
    return { date: isoDate(addDays(today, 1)), time: null };
  }
  return { date: null, time: null };
}

export function draftForInbox(
  kind: InboxKind,
  content: string,
  timeZone: string,
  now = Date.now(),
): InboxDraft {
  const title = compactTitle(content);
  if (kind === "task")
    return {
      kind,
      title,
      details: content,
      today: false,
      priority: 2,
      dueDate: null,
    };
  if (kind === "note") return { kind, title, content, tags: [] };
  const parsed = parsedInboxDate(content, timeZone, now);
  return {
    kind,
    title,
    description: content,
    allDay: !parsed.time,
    date: parsed.date,
    time: parsed.time,
    timeZone,
  };
}

/** Local heuristic only. Confidence is a rule label, never a probability. */
export function classifyInbox(
  content: string,
  timeZone: string,
  now = Date.now(),
) {
  const value = content.trim();
  const latin = latinDigits(value);
  const action =
    /\b(todo|task|need to|remember to|should|buy|call|email|finish)\b/i.test(
      latin,
    ) || /باید|انجام|یادآوری|خرید|تماس/.test(value);
  const parsed = parsedInboxDate(value, timeZone, now);
  const informational =
    /\b(note|idea|journal|reflect)\b/i.test(latin) ||
    /یادداشت|ایده|فکر/.test(value);
  const suggestion: z.infer<typeof inboxSuggestionSchema> = action
    ? { kind: "task", confidence: "high", reason: "action" }
    : parsed.date && parsed.time
      ? { kind: "event", confidence: "high", reason: "dateTime" }
      : parsed.date
        ? { kind: "event", confidence: "medium", reason: "date" }
        : informational
          ? { kind: "note", confidence: "high", reason: "informational" }
          : { kind: "note", confidence: "low", reason: "ambiguous" };
  return {
    suggestion: inboxSuggestionSchema.parse(suggestion),
    draft: inboxDraftSchema.parse(
      draftForInbox(suggestion.kind, value, timeZone, now),
    ),
  };
}
