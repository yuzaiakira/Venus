import { z } from "zod";

const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const [year, month, day] = value.split("-").map(Number);
    const date = new Date(Date.UTC(year!, month! - 1, day!));
    return (
      date.getUTCFullYear() === year &&
      date.getUTCMonth() === month! - 1 &&
      date.getUTCDate() === day
    );
  }, "Invalid calendar date");

const stampSchema = {
  id: z.string().uuid(),
  revision: z.number().int().min(1),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
};

export const reviewRatingSchema = z.enum(["again", "hard", "good", "easy"]);
export type ReviewRating = z.infer<typeof reviewRatingSchema>;

export const reviewScheduleSchema = z
  .object({
    ...stampSchema,
    profileId: z.string().uuid(),
    noteId: z.string().uuid(),
    state: z.enum(["active", "paused"]),
    dueDate: dateSchema,
    lastReviewedDate: dateSchema.nullable(),
    intervalDays: z.number().int().min(1).max(365),
    repetitions: z.number().int().min(0).max(10_000),
  })
  .strict();

export const reviewHistorySchema = z
  .object({
    id: z.string().uuid(),
    scheduleId: z.string().uuid(),
    profileId: z.string().uuid(),
    noteId: z.string().uuid(),
    outcome: z.enum(["again", "hard", "good", "easy", "postpone"]),
    reviewedDate: dateSchema,
    previousDueDate: dateSchema,
    nextDueDate: dateSchema,
    intervalDays: z.number().int().min(1).max(365),
    createdAt: z.string().datetime(),
  })
  .strict();

export type ReviewScheduleRecord = z.infer<typeof reviewScheduleSchema>;
export type ReviewHistoryRecord = z.infer<typeof reviewHistorySchema>;

export function addCalendarDays(date: string, days: number) {
  const [year, month, day] = date.split("-").map(Number);
  const result = new Date(Date.UTC(year!, month! - 1, day! + days));
  return result.toISOString().slice(0, 10);
}

/**
 * Local, deterministic scheduling policy. A newly enrolled note is due today.
 * Again resets to one day. Hard grows gently, Good doubles the interval and
 * Easy triples it. The 365-day cap keeps dates and expectations understandable.
 */
export function nextReview(
  schedule: Pick<ReviewScheduleRecord, "intervalDays" | "repetitions">,
  rating: ReviewRating,
) {
  const interval = schedule.intervalDays;
  if (rating === "again") return { intervalDays: 1, repetitions: 0 };
  const multiplier = rating === "hard" ? 1.2 : rating === "good" ? 2 : 3;
  return {
    intervalDays: Math.min(365, Math.max(1, Math.ceil(interval * multiplier))),
    repetitions: schedule.repetitions + 1,
  };
}

export function reviewState(
  schedule: Pick<ReviewScheduleRecord, "state" | "dueDate">,
  today: string,
) {
  if (schedule.state === "paused") return "paused" as const;
  if (schedule.dueDate < today) return "overdue" as const;
  if (schedule.dueDate === today) return "due" as const;
  return "upcoming" as const;
}
