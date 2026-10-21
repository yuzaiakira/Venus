import { z } from "zod";

export const localDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const [year, month, day] = value.split("-").map(Number);
    const parsed = new Date(Date.UTC(year!, month! - 1, day!));
    return (
      parsed.getUTCFullYear() === year &&
      parsed.getUTCMonth() === month! - 1 &&
      parsed.getUTCDate() === day
    );
  }, "Invalid calendar date");

export const localTimeSchema = z
  .string()
  .regex(/^\d{2}:\d{2}$/)
  .refine((value) => {
    const [hour, minute] = value.split(":").map(Number);
    return hour! <= 23 && minute! <= 59;
  }, "Invalid local time");

const stampSchema = {
  id: z.string().uuid(),
  revision: z.number().int().min(1),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
};

const optionalText = (maximum: number) =>
  z.string().trim().max(maximum).nullable();

export const personSchema = z
  .object({
    ...stampSchema,
    profileId: z.string().uuid(),
    displayName: z.string().trim().min(1).max(160),
    organization: optionalText(160),
    role: optionalText(160),
    email: z.string().trim().email().max(320).nullable(),
    phone: z.string().trim().min(1).max(80).nullable(),
    tags: z.array(z.string().trim().min(1).max(40)).max(24),
    relationshipNotes: z.string().max(8_000),
    status: z.enum(["active", "archived"]),
  })
  .strict();

export const followUpPrioritySchema = z.enum(["low", "normal", "high"]);
export const contactMethodSchema = z.enum([
  "email",
  "phone",
  "message",
  "meeting",
  "other",
]);

export const followUpSchema = z
  .object({
    ...stampSchema,
    profileId: z.string().uuid(),
    personId: z.string().uuid(),
    title: z.string().trim().min(1).max(240),
    dueDate: localDateSchema,
    dueTime: localTimeSchema.nullable(),
    timeZone: z.string().min(1).max(120),
    status: z.enum(["open", "completed"]),
    priority: followUpPrioritySchema,
    contactMethod: contactMethodSchema,
    reminderEnabled: z.boolean(),
    snoozedUntilUTC: z.number().int().positive().nullable(),
    completedAt: z.string().datetime().nullable(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.reminderEnabled && !value.dueTime)
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "A reminder needs a local due time",
        path: ["dueTime"],
      });
    try {
      new Intl.DateTimeFormat("en", { timeZone: value.timeZone }).format(0);
    } catch {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Invalid IANA timezone",
        path: ["timeZone"],
      });
    }
  });

export const interactionSchema = z
  .object({
    id: z.string().uuid(),
    profileId: z.string().uuid(),
    personId: z.string().uuid(),
    followUpId: z.string().uuid().nullable(),
    kind: z.enum([
      "note",
      "contactAttempt",
      "conversation",
      "promise",
      "followUpCompleted",
    ]),
    body: z.string().trim().min(1).max(8_000),
    occurredAt: z.string().datetime(),
    createdAt: z.string().datetime(),
  })
  .strict();

export type PersonRecord = z.infer<typeof personSchema>;
export type FollowUpRecord = z.infer<typeof followUpSchema>;
export type InteractionRecord = z.infer<typeof interactionSchema>;
export type FollowUpPriority = z.infer<typeof followUpPrioritySchema>;
export type ContactMethod = z.infer<typeof contactMethodSchema>;

export type FollowUpQueueState =
  | "overdue"
  | "due"
  | "upcoming"
  | "completed"
  | "snoozed";

/** Calendar dates are compared as date-only values, never as elapsed 24h. */
export function followUpState(
  row: Pick<FollowUpRecord, "status" | "dueDate" | "snoozedUntilUTC">,
  today: string,
  nowUTC = Date.now(),
): FollowUpQueueState {
  if (row.status === "completed") return "completed";
  if (row.snoozedUntilUTC && row.snoozedUntilUTC > nowUTC) return "snoozed";
  if (row.dueDate < today) return "overdue";
  if (row.dueDate === today) return "due";
  return "upcoming";
}

export function addLocalDays(date: string, days: number) {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year!, month! - 1, day! + days))
    .toISOString()
    .slice(0, 10);
}
