import { WorkspaceError } from "../domain/dashboard";
import {
  addCalendarDays,
  nextReview,
  reviewHistorySchema,
  reviewScheduleSchema,
  reviewState,
  type ReviewHistoryRecord,
  type ReviewRating,
  type ReviewScheduleRecord,
} from "../domain/reviews";
import type { NoteRecord } from "../domain/productivity";
import type { WorkspaceChange } from "./workspace";
import type { RowTable } from "./productivity";
import type { ProfileRecord } from "../domain/dashboard";

export interface ReviewsDatabase {
  profiles: RowTable<ProfileRecord>;
  notes: RowTable<NoteRecord>;
  reviewSchedules: RowTable<ReviewScheduleRecord>;
  reviewHistory: RowTable<ReviewHistoryRecord>;
  transaction<T>(
    mode: "rw",
    tables: RowTable<unknown>[],
    work: () => Promise<T>,
  ): Promise<T>;
}

export interface ReviewEntry extends ReviewScheduleRecord {
  note: NoteRecord | null;
  availability: "available" | "unavailable";
  queueState: ReturnType<typeof reviewState>;
  history: ReviewHistoryRecord[];
}

export interface ReviewsWorkspace {
  schedules: ReviewEntry[];
  due: ReviewEntry[];
  overdue: ReviewEntry[];
  upcoming: ReviewEntry[];
  paused: ReviewEntry[];
  completedToday: ReviewHistoryRecord[];
  eligibleNotes: NoteRecord[];
}

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
function usable(note: NoteRecord | undefined) {
  return Boolean(note && !note.trashedAt && !note.archived);
}

export function createReviews(
  database: ReviewsDatabase,
  notify: (change: WorkspaceChange) => void = () => {},
) {
  function changed(id: string, revision: number) {
    notify({ type: "workspace", id, revision });
  }
  async function requireSchedule(id: string, expected: number) {
    const current = await database.reviewSchedules.get(id);
    if (!current) throw new WorkspaceError("notFound");
    if (current.revision !== expected) throw new WorkspaceError("conflict");
    return current;
  }
  async function load(
    profileId: string,
    today: string,
  ): Promise<ReviewsWorkspace> {
    const [schedules, histories, notes] = await Promise.all([
      database.reviewSchedules.toArray(),
      database.reviewHistory.toArray(),
      database.notes.toArray(),
    ]);
    const noteById = new Map(notes.map((note) => [note.id, note]));
    const profileSchedules = schedules
      .filter((schedule) => schedule.profileId === profileId)
      .map((schedule) => {
        const note = noteById.get(schedule.noteId);
        return {
          ...schedule,
          note: usable(note) ? note! : null,
          availability: usable(note)
            ? ("available" as const)
            : ("unavailable" as const),
          queueState: reviewState(schedule, today),
          history: histories
            .filter((item) => item.scheduleId === schedule.id)
            .sort((left, right) =>
              right.createdAt.localeCompare(left.createdAt),
            ),
        };
      })
      .sort((left, right) => left.dueDate.localeCompare(right.dueDate));
    const activeAvailable = profileSchedules.filter(
      (schedule) =>
        schedule.state === "active" && schedule.availability === "available",
    );
    const scheduledNoteIds = new Set(
      profileSchedules.map((item) => item.noteId),
    );
    return {
      schedules: profileSchedules,
      due: activeAvailable.filter((schedule) => schedule.dueDate === today),
      overdue: activeAvailable.filter((schedule) => schedule.dueDate < today),
      upcoming: activeAvailable.filter((schedule) => schedule.dueDate > today),
      paused: profileSchedules.filter(
        (schedule) => schedule.state === "paused",
      ),
      completedToday: histories
        .filter(
          (item) =>
            item.profileId === profileId &&
            item.reviewedDate === today &&
            item.outcome !== "postpone",
        )
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt)),
      eligibleNotes: notes
        .filter((note) => usable(note) && !scheduledNoteIds.has(note.id))
        .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)),
    };
  }
  async function enroll(profileId: string, noteId: string, today: string) {
    const row = await database.transaction(
      "rw",
      [database.profiles, database.notes, database.reviewSchedules],
      async () => {
        if (!(await database.profiles.get(profileId)))
          throw new WorkspaceError("notFound");
        if (!usable(await database.notes.get(noteId)))
          throw new WorkspaceError("notFound");
        const existing = (await database.reviewSchedules.toArray()).find(
          (schedule) =>
            schedule.profileId === profileId && schedule.noteId === noteId,
        );
        if (existing) return existing;
        const next = reviewScheduleSchema.parse({
          id: crypto.randomUUID(),
          profileId,
          noteId,
          state: "active",
          dueDate: today,
          lastReviewedDate: null,
          intervalDays: 1,
          repetitions: 0,
          ...stamp(),
        });
        await database.reviewSchedules.put(next);
        return next;
      },
    );
    changed(row.id, row.revision);
    return row;
  }
  async function pause(id: string, expected: number) {
    const row = await database.transaction(
      "rw",
      [database.reviewSchedules],
      async () => {
        const current = await requireSchedule(id, expected);
        const next = reviewScheduleSchema.parse(
          bump(current, { state: "paused" }),
        );
        await database.reviewSchedules.put(next);
        return next;
      },
    );
    changed(row.id, row.revision);
    return row;
  }
  async function resume(id: string, expected: number, today: string) {
    const row = await database.transaction(
      "rw",
      [database.reviewSchedules],
      async () => {
        const current = await requireSchedule(id, expected);
        const next = reviewScheduleSchema.parse(
          bump(current, {
            state: "active",
            dueDate: current.dueDate < today ? today : current.dueDate,
          }),
        );
        await database.reviewSchedules.put(next);
        return next;
      },
    );
    changed(row.id, row.revision);
    return row;
  }
  async function remove(id: string, expected: number) {
    const row = await database.transaction(
      "rw",
      [database.reviewSchedules, database.reviewHistory],
      async () => {
        const current = await requireSchedule(id, expected);
        for (const history of await database.reviewHistory.toArray())
          if (history.scheduleId === id)
            await database.reviewHistory.delete(history.id);
        await database.reviewSchedules.delete(id);
        return current;
      },
    );
    changed(row.id, row.revision + 1);
  }
  async function submitRating(
    id: string,
    expected: number,
    rating: ReviewRating,
    reviewedDate: string,
  ) {
    const row = await database.transaction(
      "rw",
      [database.reviewSchedules, database.reviewHistory, database.notes],
      async () => {
        const current = await requireSchedule(id, expected);
        if (
          current.state !== "active" ||
          !usable(await database.notes.get(current.noteId))
        )
          throw new WorkspaceError("notFound");
        const transition = nextReview(current, rating);
        const next = reviewScheduleSchema.parse(
          bump(current, {
            ...transition,
            lastReviewedDate: reviewedDate,
            dueDate: addCalendarDays(reviewedDate, transition.intervalDays),
          }),
        );
        const history = reviewHistorySchema.parse({
          id: crypto.randomUUID(),
          scheduleId: current.id,
          profileId: current.profileId,
          noteId: current.noteId,
          outcome: rating,
          reviewedDate,
          previousDueDate: current.dueDate,
          nextDueDate: next.dueDate,
          intervalDays: next.intervalDays,
          createdAt: new Date().toISOString(),
        });
        await database.reviewSchedules.put(next);
        await database.reviewHistory.put(history);
        return next;
      },
    );
    changed(row.id, row.revision);
    return row;
  }
  async function postpone(id: string, expected: number, today: string) {
    const row = await database.transaction(
      "rw",
      [database.reviewSchedules, database.reviewHistory, database.notes],
      async () => {
        const current = await requireSchedule(id, expected);
        if (
          current.state !== "active" ||
          !usable(await database.notes.get(current.noteId))
        )
          throw new WorkspaceError("notFound");
        const next = reviewScheduleSchema.parse(
          bump(current, {
            dueDate: addCalendarDays(
              current.dueDate < today ? today : current.dueDate,
              1,
            ),
          }),
        );
        const history = reviewHistorySchema.parse({
          id: crypto.randomUUID(),
          scheduleId: current.id,
          profileId: current.profileId,
          noteId: current.noteId,
          outcome: "postpone",
          reviewedDate: today,
          previousDueDate: current.dueDate,
          nextDueDate: next.dueDate,
          intervalDays: next.intervalDays,
          createdAt: new Date().toISOString(),
        });
        await database.reviewSchedules.put(next);
        await database.reviewHistory.put(history);
        return next;
      },
    );
    changed(row.id, row.revision);
    return row;
  }
  return { load, enroll, pause, resume, remove, submitRating, postpone };
}

export type Reviews = ReturnType<typeof createReviews>;
