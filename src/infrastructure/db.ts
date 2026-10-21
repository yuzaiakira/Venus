import Dexie, { type EntityTable } from "dexie";
import type { CalendarDatabase } from "../application/calendar";
import type { GoalsDatabase } from "../application/goals";
import type { ReviewsDatabase } from "../application/reviews";
import type { PeopleDatabase } from "../application/people";
import type { FocusDatabase } from "../application/focus";
import type { ProductivityDatabase } from "../application/productivity";
import type {
  AssetRecord,
  ProfileRecord,
  SharedItem,
  WidgetRecord,
} from "../domain/dashboard";
import { ProbeSchema, type Probe } from "../domain/foundation";
import type {
  BookmarkSnapshotRecord,
  FolderRecord,
  LocalBookmarkRecord,
  NoteRecord,
  NoteDraft,
  TaskRecord,
  HabitRecord,
} from "../domain/productivity";
import type {
  GoalRecord,
  GoalRelationRecord,
  MilestoneRecord,
  WeeklyReviewRecord,
} from "../domain/goals";
import type {
  ReviewHistoryRecord,
  ReviewScheduleRecord,
} from "../domain/reviews";
import type {
  FollowUpRecord,
  InteractionRecord,
  PersonRecord,
} from "../domain/people";
import type { FocusDeferralRecord } from "../domain/focus";
import type {
  PluginInstanceRecord,
  PluginPackageRecord,
} from "../domain/plugins/records";
import type {
  EventRecord,
  NotificationRecord,
  QuietHoursRecord,
  ReminderRuleRecord,
  TimerRecord,
} from "../domain/time/records";
export const db = new Dexie("Venus-p00") as Dexie & {
  probes: EntityTable<Probe, "id">;
  profiles: EntityTable<ProfileRecord, "id">;
  widgets: EntityTable<WidgetRecord, "id">;
  sharedItems: EntityTable<SharedItem, "id">;
  assets: EntityTable<AssetRecord, "id">;
  notes: EntityTable<NoteRecord, "id">;
  noteDrafts: EntityTable<NoteDraft, "id">;
  folders: EntityTable<FolderRecord, "id">;
  tasks: EntityTable<TaskRecord, "id">;
  habits: EntityTable<HabitRecord, "id">;
  goals: EntityTable<GoalRecord, "id">;
  milestones: EntityTable<MilestoneRecord, "id">;
  goalRelations: EntityTable<GoalRelationRecord, "id">;
  weeklyReviews: EntityTable<WeeklyReviewRecord, "id">;
  reviewSchedules: EntityTable<ReviewScheduleRecord, "id">;
  reviewHistory: EntityTable<ReviewHistoryRecord, "id">;
  people: EntityTable<PersonRecord, "id">;
  followUps: EntityTable<FollowUpRecord, "id">;
  interactions: EntityTable<InteractionRecord, "id">;
  focusDeferrals: EntityTable<FocusDeferralRecord, "id">;
  localBookmarks: EntityTable<LocalBookmarkRecord, "id">;
  bookmarkSnapshots: EntityTable<BookmarkSnapshotRecord, "id">;
  events: EntityTable<EventRecord, "id">;
  reminderRules: EntityTable<ReminderRuleRecord, "id">;
  notificationOccurrences: EntityTable<NotificationRecord, "idempotencyKey">;
  timerSessions: EntityTable<TimerRecord, "id">;
  quietHours: EntityTable<QuietHoursRecord, "id">;
  pluginPackages: EntityTable<PluginPackageRecord, "id">;
  pluginInstanceData: EntityTable<PluginInstanceRecord, "id">;
};
db.version(1).stores({ probes: "id,state,dueAt" });
db.version(2).stores({
  probes: "id,state,dueAt",
  profiles: "id,updatedAt",
  widgets: "id,profileId",
  sharedItems: "id,kind",
  assets: "id",
});
db.version(3).stores({
  probes: "id,state,dueAt",
  profiles: "id,updatedAt",
  widgets: "id,profileId",
  sharedItems: "id,kind",
  assets: "id",
  notes: "id, folderId, pinned, trashedAt, updatedAt",
  folders: "id, scope, parentId",
  tasks: "id, status, dueDate, focusRank",
  localBookmarks: "id, folderId, quick",
  bookmarkSnapshots: "id, capturedAt",
});
db.version(4).stores({
  probes: "id,state,dueAt",
  profiles: "id,updatedAt",
  widgets: "id,profileId",
  sharedItems: "id,kind",
  assets: "id",
  notes: "id, folderId, pinned, trashedAt, updatedAt",
  folders: "id, scope, parentId",
  tasks: "id, status, dueDate, focusRank",
  localBookmarks: "id, folderId, quick",
  bookmarkSnapshots: "id, capturedAt",
  events: "id, zoneId, updatedAt",
  reminderRules: "id, eventId, taskId",
  notificationOccurrences: "idempotencyKey, fireAtUTC, internalStatus, ownerId",
  timerSessions: "id, status",
  quietHours: "id",
});
db.version(5).stores({
  probes: "id,state,dueAt",
  profiles: "id,updatedAt",
  widgets: "id,profileId",
  sharedItems: "id,kind",
  assets: "id",
  notes: "id, folderId, pinned, trashedAt, updatedAt",
  folders: "id, scope, parentId",
  tasks: "id, status, dueDate, focusRank",
  localBookmarks: "id, folderId, quick",
  bookmarkSnapshots: "id, capturedAt",
  events: "id, zoneId, updatedAt",
  reminderRules: "id, eventId, taskId",
  notificationOccurrences: "idempotencyKey, fireAtUTC, internalStatus, ownerId",
  timerSessions: "id, status",
  quietHours: "id",
  pluginPackages: "id, enabled, installedAt",
  pluginInstanceData: "id, pluginId, instanceId, updatedAt",
});
// Additive repair migration: retain every existing table, ID and revision.
db.version(6)
  .stores({
    noteDrafts: "id, noteId, updatedAt",
    tasks: "id, status, dueDate, focusRank, column, sortIndex",
    notes: "id, folderId, pinned, trashedAt, updatedAt, sortIndex",
  })
  .upgrade(async (tx) => {
    let taskOrder = 0;
    await tx
      .table("tasks")
      .toCollection()
      .modify((task) => {
        task.column ??= task.status === "done" ? "done" : "todo";
        task.sortIndex ??= taskOrder++;
        task.today ??= task.focusRank != null;
        task.todayOrder ??= task.focusRank ?? task.sortIndex;
        task.labels ??= [];
        task.checklist ??= [];
        task.completedAt ??=
          task.status === "done"
            ? (task.updatedAt ?? task.createdAt ?? null)
            : null;
      });
    const notes = await tx.table("notes").toArray();
    notes.sort((a, b) =>
      String(b.updatedAt ?? "").localeCompare(String(a.updatedAt ?? "")),
    );
    for (const [index, note] of notes.entries()) {
      note.sortIndex ??= index;
      await tx.table("notes").put(note);
    }
  });
db.version(7).stores({ habits: "id,updatedAt,frequency" });
// v8 adds an index for habit-owned rules; existing event/task rules retain
// their IDs and owner fields unchanged.
db.version(8).stores({ reminderRules: "id, eventId, taskId, habitId" });
// v9 is additive. Existing workspace, task, habit, reminder and widget rows
// remain untouched while profile-owned Goals & Progress records are added.
db.version(9).stores({
  goals: "id, profileId, status, updatedAt",
  milestones: "id, goalId, sortIndex, targetDate",
  goalRelations:
    "id, goalId, [goalId+targetKind+targetId], targetKind, targetId",
  weeklyReviews: "id, goalId, profileId, periodStart",
});
// v10 is additive: Knowledge Review keeps a profile-owned schedule and local
// outcome history while every existing note and workspace record stays intact.
db.version(10).stores({
  reviewSchedules: "id, profileId, noteId, [profileId+noteId], state, dueDate",
  reviewHistory: "id, scheduleId, profileId, noteId, reviewedDate, outcome",
});
// v11 is additive: profile-owned people, follow-ups and interaction history.
// The follow-up reminder index keeps existing event/task/habit rules intact.
db.version(11).stores({
  people: "id, profileId, status, displayName, updatedAt",
  followUps:
    "id, profileId, personId, [profileId+personId], status, dueDate, priority, contactMethod",
  interactions: "id, profileId, personId, followUpId, occurredAt",
  reminderRules: "id, eventId, taskId, habitId, followUpId",
});
// v12 retains all planning records. It adds only per-profile, local choices
// to defer or snooze Focus Coach recommendations.
db.version(12).stores({
  focusDeferrals:
    "id, profileId, taskId, [profileId+taskId], deferredUntilDate, snoozedUntilUTC, updatedAt",
});
export const productivityDb: ProductivityDatabase = {
  notes: db.notes,
  noteDrafts: db.noteDrafts,
  folders: db.folders,
  tasks: db.tasks,
  localBookmarks: db.localBookmarks,
  bookmarkSnapshots: db.bookmarkSnapshots,
  habits: db.habits,
  transaction: (_mode, _tables, work) =>
    db.transaction(
      "rw",
      [
        db.notes,
        db.noteDrafts,
        db.folders,
        db.tasks,
        db.localBookmarks,
        db.bookmarkSnapshots,
        db.habits,
      ],
      work,
    ),
};
export const calendarDb: CalendarDatabase = {
  habits: db.habits,
  followUps: db.followUps,
  events: db.events,
  reminderRules: db.reminderRules,
  notificationOccurrences: db.notificationOccurrences,
  timerSessions: db.timerSessions,
  quietHours: db.quietHours,
  transaction: (work) =>
    db.transaction(
      "rw",
      [
        db.events,
        db.reminderRules,
        db.notificationOccurrences,
        db.timerSessions,
        db.quietHours,
        db.habits,
        db.followUps,
      ],
      work,
    ),
};
export const peopleDb: PeopleDatabase = {
  profiles: db.profiles,
  people: db.people,
  followUps: db.followUps,
  interactions: db.interactions,
  transaction: (_mode, _tables, work) =>
    db.transaction(
      "rw",
      [db.profiles, db.people, db.followUps, db.interactions],
      work,
    ),
};
export const focusDb: FocusDatabase = {
  profiles: db.profiles,
  tasks: db.tasks,
  events: db.events,
  timerSessions: db.timerSessions,
  focusDeferrals: db.focusDeferrals,
  transaction: (_mode, _tables, work) =>
    db.transaction(
      "rw",
      [db.profiles, db.tasks, db.events, db.timerSessions, db.focusDeferrals],
      work,
    ),
};
export const goalsDb: GoalsDatabase = {
  profiles: db.profiles,
  goals: db.goals,
  milestones: db.milestones,
  goalRelations: db.goalRelations,
  weeklyReviews: db.weeklyReviews,
  tasks: db.tasks,
  habits: db.habits,
  transaction: (_mode, _tables, work) =>
    db.transaction(
      "rw",
      [
        db.profiles,
        db.goals,
        db.milestones,
        db.goalRelations,
        db.weeklyReviews,
        db.tasks,
        db.habits,
      ],
      work,
    ),
};
export const reviewsDb: ReviewsDatabase = {
  profiles: db.profiles,
  notes: db.notes,
  reviewSchedules: db.reviewSchedules,
  reviewHistory: db.reviewHistory,
  transaction: (_mode, _tables, work) =>
    db.transaction(
      "rw",
      [db.profiles, db.notes, db.reviewSchedules, db.reviewHistory],
      work,
    ),
};
export async function saveProbe(input: unknown) {
  const probe = ProbeSchema.parse(input);
  await db.probes.put(probe);
  return probe;
}
export async function claimProbe(id: string): Promise<boolean> {
  return db.transaction("rw", db.probes, async () => {
    const probe = await db.probes.get(id);
    if (!probe || probe.state !== "pending") return false;
    await db.probes.update(id, { state: "due" });
    return true;
  });
}

// Read and transition in one transaction: a concurrent native claim cannot be
// overwritten by an outdated startup snapshot.
export async function recoverProbes(
  now: number,
  markMissed = true,
): Promise<Probe[]> {
  return db.transaction("rw", db.probes, async () => {
    const probes = await db.probes.toArray();
    for (const probe of probes) {
      if (markMissed && probe.state === "pending" && probe.dueAt < now) {
        probe.state = "missed";
        await db.probes.put(probe);
      }
    }
    return probes;
  });
}
