import { WorkspaceError, type ProfileRecord } from "../domain/dashboard";
import {
  goalRelationSchema,
  goalSchema,
  milestoneSchema,
  nextMilestone,
  progressSummary,
  weeklyReviewSchema,
  type GoalProgress,
  type GoalRecord,
  type GoalRelationRecord,
  type MilestoneRecord,
  type ProgressSummary,
  type WeeklyReviewRecord,
} from "../domain/goals";
import type { HabitRecord, TaskRecord } from "../domain/productivity";
import type { RowTable } from "./productivity";
import type { WorkspaceChange } from "./workspace";

export interface GoalsDatabase {
  profiles: RowTable<ProfileRecord>;
  goals: RowTable<GoalRecord>;
  milestones: RowTable<MilestoneRecord>;
  goalRelations: RowTable<GoalRelationRecord>;
  weeklyReviews: RowTable<WeeklyReviewRecord>;
  tasks: RowTable<TaskRecord>;
  habits: RowTable<HabitRecord>;
  transaction<T>(
    mode: "rw",
    tables: RowTable<unknown>[],
    work: () => Promise<T>,
  ): Promise<T>;
}

export interface GoalLink extends GoalRelationRecord {
  title: string | null;
  available: boolean;
  complete: boolean | null;
}
export interface GoalDetails extends GoalRecord {
  milestones: MilestoneRecord[];
  relations: GoalLink[];
  reviews: WeeklyReviewRecord[];
  progressSummary: ProgressSummary;
  nextMilestone: MilestoneRecord | undefined;
}
export interface GoalsWorkspace {
  goals: GoalDetails[];
  tasks: TaskRecord[];
  habits: HabitRecord[];
}

export type GoalDraft = Pick<
  GoalRecord,
  "title" | "description" | "startDate" | "targetDate" | "progress"
>;
export type MilestoneDraft = Pick<MilestoneRecord, "title" | "targetDate">;
export type ReviewDraft = Pick<
  WeeklyReviewRecord,
  | "periodStart"
  | "periodEnd"
  | "accomplishments"
  | "blockers"
  | "notes"
  | "nextActions"
>;

function stamp(revision = 1) {
  const now = new Date().toISOString();
  return { revision, createdAt: now, updatedAt: now };
}
function bump<T extends { revision: number; updatedAt: string }>(
  row: T,
  patch: Partial<T>,
): T {
  return {
    ...row,
    ...patch,
    revision: row.revision + 1,
    updatedAt: new Date().toISOString(),
  };
}

export function createGoals(
  database: GoalsDatabase,
  notify: (change: WorkspaceChange) => void = () => {},
) {
  function changed(id: string, revision: number) {
    notify({ type: "workspace", id, revision });
  }
  async function requireGoal(id: string) {
    const row = await database.goals.get(id);
    if (!row) throw new WorkspaceError("notFound");
    return row;
  }
  async function requireCurrentGoal(id: string, expected: number) {
    const row = await requireGoal(id);
    if (row.revision !== expected) throw new WorkspaceError("conflict");
    return row;
  }
  async function assertProfile(profileId: string) {
    if (!(await database.profiles.get(profileId)))
      throw new WorkspaceError("notFound");
  }
  async function linkedData(goal: GoalRecord) {
    const [relations, tasks, habits] = await Promise.all([
      database.goalRelations.toArray(),
      database.tasks.toArray(),
      database.habits.toArray(),
    ]);
    return {
      relations: relations.filter((relation) => relation.goalId === goal.id),
      tasks,
      habits,
    };
  }

  async function load(profileId: string): Promise<GoalsWorkspace> {
    const [rows, milestones, relations, reviews, tasks, habits] =
      await Promise.all([
        database.goals.toArray(),
        database.milestones.toArray(),
        database.goalRelations.toArray(),
        database.weeklyReviews.toArray(),
        database.tasks.toArray(),
        database.habits.toArray(),
      ]);
    const taskById = new Map(tasks.map((task) => [task.id, task]));
    const habitById = new Map(habits.map((habit) => [habit.id, habit]));
    const goals = rows
      .filter((goal) => goal.profileId === profileId)
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
      .map((goal) => {
        const goalRelations = relations.filter(
          (relation) => relation.goalId === goal.id,
        );
        const goalMilestones = milestones
          .filter((milestone) => milestone.goalId === goal.id)
          .sort((left, right) => left.sortIndex - right.sortIndex);
        const links: GoalLink[] = goalRelations.map((relation) => {
          const task = taskById.get(relation.targetId);
          const habit = habitById.get(relation.targetId);
          const target = relation.targetKind === "task" ? task : habit;
          return {
            ...relation,
            available: Boolean(target),
            title: target?.title ?? null,
            complete:
              relation.targetKind === "task" ? task?.status === "done" : null,
          };
        });
        return {
          ...goal,
          milestones: goalMilestones,
          relations: links,
          reviews: reviews
            .filter((review) => review.goalId === goal.id)
            .sort((left, right) =>
              right.periodStart.localeCompare(left.periodStart),
            ),
          progressSummary: progressSummary({
            goal,
            relations: goalRelations,
            tasks,
            habits,
          }),
          nextMilestone: nextMilestone(goalMilestones),
        };
      });
    return { goals, tasks, habits };
  }

  async function createGoal(profileId: string, draft: GoalDraft) {
    const row = await database.transaction(
      "rw",
      [database.profiles, database.goals],
      async () => {
        await assertProfile(profileId);
        const next = goalSchema.parse({
          id: crypto.randomUUID(),
          profileId,
          title: draft.title.trim(),
          description: draft.description.trim(),
          status: "active",
          startDate: draft.startDate,
          targetDate: draft.targetDate,
          progress: draft.progress,
          ...stamp(),
        });
        await database.goals.put(next);
        return next;
      },
    );
    changed(row.id, row.revision);
    return row;
  }

  async function updateGoal(
    id: string,
    expected: number,
    patch: Partial<
      Pick<
        GoalRecord,
        | "title"
        | "description"
        | "status"
        | "startDate"
        | "targetDate"
        | "progress"
      >
    >,
  ) {
    const row = await database.transaction("rw", [database.goals], async () => {
      const current = await requireCurrentGoal(id, expected);
      const next = goalSchema.parse(
        bump(current, {
          title: patch.title === undefined ? current.title : patch.title.trim(),
          description:
            patch.description === undefined
              ? current.description
              : patch.description.trim(),
          status: patch.status ?? current.status,
          startDate: patch.startDate ?? current.startDate,
          targetDate:
            patch.targetDate === undefined
              ? current.targetDate
              : patch.targetDate,
          progress: patch.progress ?? current.progress,
        }),
      );
      await database.goals.put(next);
      return next;
    });
    changed(row.id, row.revision);
    return row;
  }

  async function archiveGoal(id: string, expected: number, archived = true) {
    return updateGoal(id, expected, {
      status: archived ? "archived" : "active",
    });
  }

  async function deleteGoal(id: string, expected: number) {
    const row = await database.transaction(
      "rw",
      [
        database.goals,
        database.milestones,
        database.goalRelations,
        database.weeklyReviews,
      ],
      async () => {
        const current = await requireCurrentGoal(id, expected);
        const [milestones, relations, reviews] = await Promise.all([
          database.milestones.toArray(),
          database.goalRelations.toArray(),
          database.weeklyReviews.toArray(),
        ]);
        await Promise.all([
          ...milestones
            .filter((milestone) => milestone.goalId === id)
            .map((milestone) => database.milestones.delete(milestone.id)),
          ...relations
            .filter((relation) => relation.goalId === id)
            .map((relation) => database.goalRelations.delete(relation.id)),
          ...reviews
            .filter((review) => review.goalId === id)
            .map((review) => database.weeklyReviews.delete(review.id)),
        ]);
        await database.goals.delete(id);
        return current;
      },
    );
    changed(row.id, row.revision + 1);
  }

  async function createMilestone(
    goalId: string,
    goalRevision: number,
    draft: MilestoneDraft,
  ) {
    const row = await database.transaction(
      "rw",
      [database.goals, database.milestones],
      async () => {
        await requireCurrentGoal(goalId, goalRevision);
        const rows = await database.milestones.toArray();
        const next = milestoneSchema.parse({
          id: crypto.randomUUID(),
          goalId,
          title: draft.title.trim(),
          targetDate: draft.targetDate,
          completed: false,
          sortIndex: rows.filter((milestone) => milestone.goalId === goalId)
            .length,
          ...stamp(),
        });
        await database.milestones.put(next);
        return next;
      },
    );
    changed(goalId, goalRevision + 1);
    return row;
  }

  async function updateMilestone(
    id: string,
    expected: number,
    patch: Partial<Pick<MilestoneRecord, "title" | "targetDate" | "completed">>,
  ) {
    const row = await database.transaction(
      "rw",
      [database.milestones],
      async () => {
        const current = await database.milestones.get(id);
        if (!current) throw new WorkspaceError("notFound");
        if (current.revision !== expected) throw new WorkspaceError("conflict");
        const next = milestoneSchema.parse(
          bump(current, {
            title:
              patch.title === undefined ? current.title : patch.title.trim(),
            targetDate:
              patch.targetDate === undefined
                ? current.targetDate
                : patch.targetDate,
            completed: patch.completed ?? current.completed,
          }),
        );
        await database.milestones.put(next);
        return next;
      },
    );
    changed(row.goalId, row.revision);
    return row;
  }

  async function reorderMilestones(
    goalId: string,
    rows: Array<{ id: string; revision: number }>,
  ) {
    await database.transaction("rw", [database.milestones], async () => {
      const stored = (await database.milestones.toArray())
        .filter((milestone) => milestone.goalId === goalId)
        .sort((left, right) => left.sortIndex - right.sortIndex);
      if (
        rows.length !== stored.length ||
        new Set(rows.map((row) => row.id)).size !== rows.length
      )
        throw new WorkspaceError("invalidInput");
      const byId = new Map(
        stored.map((milestone) => [milestone.id, milestone]),
      );
      for (const [sortIndex, input] of rows.entries()) {
        const current = byId.get(input.id);
        if (!current) throw new WorkspaceError("invalidInput");
        if (current.revision !== input.revision)
          throw new WorkspaceError("conflict");
        await database.milestones.put(
          milestoneSchema.parse(bump(current, { sortIndex })),
        );
      }
    });
    changed(goalId, Date.now());
  }

  async function deleteMilestone(id: string, expected: number) {
    const row = await database.transaction(
      "rw",
      [database.milestones],
      async () => {
        const current = await database.milestones.get(id);
        if (!current) throw new WorkspaceError("notFound");
        if (current.revision !== expected) throw new WorkspaceError("conflict");
        await database.milestones.delete(id);
        return current;
      },
    );
    changed(row.goalId, row.revision + 1);
  }

  async function linkRecord(
    goalId: string,
    goalRevision: number,
    targetKind: GoalRelationRecord["targetKind"],
    targetId: string,
  ) {
    const row = await database.transaction(
      "rw",
      [database.goals, database.goalRelations, database.tasks, database.habits],
      async () => {
        await requireCurrentGoal(goalId, goalRevision);
        const target =
          targetKind === "task"
            ? await database.tasks.get(targetId)
            : await database.habits.get(targetId);
        if (!target) throw new WorkspaceError("notFound");
        const existing = (await database.goalRelations.toArray()).find(
          (relation) =>
            relation.goalId === goalId &&
            relation.targetKind === targetKind &&
            relation.targetId === targetId,
        );
        if (existing) return existing;
        const next = goalRelationSchema.parse({
          id: crypto.randomUUID(),
          goalId,
          targetKind,
          targetId,
          ...stamp(),
        });
        await database.goalRelations.put(next);
        return next;
      },
    );
    changed(goalId, row.revision);
    return row;
  }

  async function unlinkRecord(id: string, expected: number) {
    const row = await database.transaction(
      "rw",
      [database.goalRelations],
      async () => {
        const current = await database.goalRelations.get(id);
        if (!current) throw new WorkspaceError("notFound");
        if (current.revision !== expected) throw new WorkspaceError("conflict");
        await database.goalRelations.delete(id);
        return current;
      },
    );
    changed(row.goalId, row.revision + 1);
  }

  async function createWeeklyReview(
    goalId: string,
    goalRevision: number,
    draft: ReviewDraft,
  ) {
    const row = await database.transaction(
      "rw",
      [
        database.goals,
        database.weeklyReviews,
        database.goalRelations,
        database.tasks,
        database.habits,
      ],
      async () => {
        const goal = await requireCurrentGoal(goalId, goalRevision);
        const existing = (await database.weeklyReviews.toArray()).find(
          (review) =>
            review.goalId === goalId &&
            review.periodStart === draft.periodStart,
        );
        if (existing) throw new WorkspaceError("conflict");
        const data = await linkedData(goal);
        const summary = progressSummary({ goal, ...data });
        const next = weeklyReviewSchema.parse({
          id: crypto.randomUUID(),
          goalId,
          profileId: goal.profileId,
          periodStart: draft.periodStart,
          periodEnd: draft.periodEnd,
          progressSummary: summary.percent,
          accomplishments: draft.accomplishments.trim(),
          blockers: draft.blockers.trim(),
          notes: draft.notes.trim(),
          nextActions: draft.nextActions.trim(),
          ...stamp(),
        });
        await database.weeklyReviews.put(next);
        return next;
      },
    );
    changed(goalId, row.revision);
    return row;
  }

  async function updateWeeklyReview(
    id: string,
    expected: number,
    patch: Partial<ReviewDraft>,
  ) {
    const row = await database.transaction(
      "rw",
      [database.weeklyReviews],
      async () => {
        const current = await database.weeklyReviews.get(id);
        if (!current) throw new WorkspaceError("notFound");
        if (current.revision !== expected) throw new WorkspaceError("conflict");
        const next = weeklyReviewSchema.parse(
          bump(current, {
            periodStart: patch.periodStart ?? current.periodStart,
            periodEnd: patch.periodEnd ?? current.periodEnd,
            accomplishments:
              patch.accomplishments === undefined
                ? current.accomplishments
                : patch.accomplishments.trim(),
            blockers:
              patch.blockers === undefined
                ? current.blockers
                : patch.blockers.trim(),
            notes:
              patch.notes === undefined ? current.notes : patch.notes.trim(),
            nextActions:
              patch.nextActions === undefined
                ? current.nextActions
                : patch.nextActions.trim(),
          }),
        );
        await database.weeklyReviews.put(next);
        return next;
      },
    );
    changed(row.goalId, row.revision);
    return row;
  }

  return {
    load,
    createGoal,
    updateGoal,
    archiveGoal,
    deleteGoal,
    createMilestone,
    updateMilestone,
    reorderMilestones,
    deleteMilestone,
    linkRecord,
    unlinkRecord,
    createWeeklyReview,
    updateWeeklyReview,
  };
}

export type Goals = ReturnType<typeof createGoals>;
export type { GoalProgress };
