import { z } from "zod";

const titleLimit = 300;
const textLimit = 20_000;

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

export const goalProgressSchema = z
  .discriminatedUnion("mode", [
    z
      .object({
        mode: z.literal("manual"),
        target: z.number().finite().positive().max(1_000_000),
        current: z.number().finite().min(0).max(1_000_000),
      })
      .strict(),
    z.object({ mode: z.literal("linkedTasks") }).strict(),
    z
      .object({
        mode: z.literal("habitCheckIns"),
        target: z.number().int().positive().max(1_000_000),
        periodStart: dateSchema,
        periodEnd: dateSchema,
      })
      .strict(),
  ])
  .superRefine((value, context) => {
    if (value.mode === "manual" && value.current > value.target)
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["current"],
        message: "Manual progress cannot exceed its target",
      });
    if (value.mode === "habitCheckIns" && value.periodEnd < value.periodStart)
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["periodEnd"],
        message: "Habit progress period ends before it starts",
      });
  });

export const goalSchema = z
  .object({
    ...stampSchema,
    profileId: z.string().uuid(),
    title: z.string().trim().min(1).max(titleLimit),
    description: z.string().max(textLimit),
    status: z.enum(["active", "archived", "completed"]),
    startDate: dateSchema,
    targetDate: dateSchema.nullable(),
    progress: goalProgressSchema,
  })
  .strict()
  .superRefine((value, context) => {
    if (value.targetDate && value.targetDate < value.startDate)
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["targetDate"],
        message: "Target date is before the start date",
      });
  });

export const milestoneSchema = z
  .object({
    ...stampSchema,
    goalId: z.string().uuid(),
    title: z.string().trim().min(1).max(titleLimit),
    targetDate: dateSchema.nullable(),
    completed: z.boolean(),
    sortIndex: z.number().int().min(0),
  })
  .strict();

export const goalRelationSchema = z
  .object({
    ...stampSchema,
    goalId: z.string().uuid(),
    targetKind: z.enum(["task", "habit"]),
    targetId: z.string().uuid(),
  })
  .strict();

export const weeklyReviewSchema = z
  .object({
    ...stampSchema,
    goalId: z.string().uuid(),
    profileId: z.string().uuid(),
    periodStart: dateSchema,
    periodEnd: dateSchema,
    progressSummary: z.number().int().min(0).max(100),
    accomplishments: z.string().max(textLimit),
    blockers: z.string().max(textLimit),
    notes: z.string().max(textLimit),
    nextActions: z.string().max(textLimit),
  })
  .strict()
  .refine((value) => value.periodStart <= value.periodEnd, {
    message: "Review period ends before it starts",
    path: ["periodEnd"],
  });

export type GoalRecord = z.infer<typeof goalSchema>;
export type GoalProgress = z.infer<typeof goalProgressSchema>;
export type MilestoneRecord = z.infer<typeof milestoneSchema>;
export type GoalRelationRecord = z.infer<typeof goalRelationSchema>;
export type WeeklyReviewRecord = z.infer<typeof weeklyReviewSchema>;

export interface ProgressSummary {
  mode: GoalProgress["mode"];
  current: number;
  target: number | null;
  percent: number;
  remaining: number | null;
  linked: number;
  unavailable: number;
}

export function progressSummary(input: {
  goal: GoalRecord;
  relations: GoalRelationRecord[];
  tasks: Array<{ id: string; status: "open" | "done" }>;
  habits: Array<{ id: string; checkIns: string[] }>;
}): ProgressSummary {
  const { goal, relations } = input;
  const configuration = goal.progress;
  if (configuration.mode === "manual") {
    const { current, target } = configuration;
    return {
      mode: "manual",
      current,
      target,
      percent: Math.round((current / target) * 100),
      remaining: target - current,
      linked: 0,
      unavailable: 0,
    };
  }

  if (configuration.mode === "linkedTasks") {
    const targets = new Set(
      relations
        .filter((relation) => relation.targetKind === "task")
        .map((relation) => relation.targetId),
    );
    const tasks = input.tasks.filter((task) => targets.has(task.id));
    const complete = tasks.filter((task) => task.status === "done").length;
    return {
      mode: "linkedTasks",
      current: complete,
      target: tasks.length,
      percent: tasks.length ? Math.round((complete / tasks.length) * 100) : 0,
      remaining: tasks.length - complete,
      linked: tasks.length,
      unavailable: targets.size - tasks.length,
    };
  }

  const targets = new Set(
    relations
      .filter((relation) => relation.targetKind === "habit")
      .map((relation) => relation.targetId),
  );
  const habits = input.habits.filter((habit) => targets.has(habit.id));
  const current = habits.reduce(
    (count, habit) =>
      count +
      [...new Set(habit.checkIns)].filter(
        (date) =>
          date >= configuration.periodStart && date <= configuration.periodEnd,
      ).length,
    0,
  );
  const target = configuration.target;
  return {
    mode: "habitCheckIns",
    current,
    target,
    percent: Math.min(100, Math.round((current / target) * 100)),
    remaining: Math.max(0, target - current),
    linked: habits.length,
    unavailable: targets.size - habits.length,
  };
}

export function nextMilestone(milestones: MilestoneRecord[]) {
  return [...milestones]
    .filter((milestone) => !milestone.completed)
    .sort(
      (left, right) =>
        (left.targetDate ?? "9999-12-31").localeCompare(
          right.targetDate ?? "9999-12-31",
        ) || left.sortIndex - right.sortIndex,
    )[0];
}
