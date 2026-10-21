import { liveQuery } from "dexie";
import { browser } from "wxt/browser";
import { createCalendar } from "../application/calendar";
import { createGoals } from "../application/goals";
import { createPeople } from "../application/people";
import { createFocus } from "../application/focus";
import { createReviews } from "../application/reviews";
import { createProductivity } from "../application/productivity";
import {
  calendarDb,
  db,
  focusDb,
  goalsDb,
  peopleDb,
  productivityDb,
  reviewsDb,
} from "./db";
import { productNotifications, sweepAlarmPort } from "./browser";
import {
  createWorkspace,
  type WorkspaceChange,
} from "../application/workspace";
import type { PermissionOutcome } from "../domain/commands";
import { createPluginPlatform } from "../application/plugins";
import { preferences } from "./browser";

const channel =
  typeof BroadcastChannel === "undefined"
    ? null
    : new BroadcastChannel("venus-workspace");
const localListeners = new Set<() => void>();

function publish(change: WorkspaceChange) {
  channel?.postMessage(change);
  // BroadcastChannel does not deliver a message to its sender.
  localListeners.forEach((listener) => listener());
}

export const workspace = createWorkspace(
  {
    get: (key) => preferences.get(key),
    set: (key, value) => preferences.set(key, value),
    subscribe(listener) {
      const onChanged = () => listener();
      browser.storage.onChanged.addListener(onChanged);
      const onMessage = () => listener();
      channel?.addEventListener("message", onMessage);
      localListeners.add(listener);
      // Calendar/background writes do not pass through workspace.publish.
      // Dexie observes committed changes across extension contexts.
      const databaseChanges = liveQuery(async () =>
        Promise.all([
          db.events.toArray(),
          db.habits.toArray(),
          db.goals.toArray(),
          db.milestones.toArray(),
          db.goalRelations.toArray(),
          db.weeklyReviews.toArray(),
          db.reviewSchedules.toArray(),
          db.reviewHistory.toArray(),
          db.people.toArray(),
          db.followUps.toArray(),
          db.interactions.toArray(),
          db.focusDeferrals.toArray(),
          db.timerSessions.toArray(),
          db.notificationOccurrences.toArray(),
          db.quietHours.toArray(),
        ]),
      ).subscribe({ next: () => listener(), error: () => listener() });
      return () => {
        databaseChanges.unsubscribe();
        localListeners.delete(listener);
        browser.storage.onChanged.removeListener(onChanged);
        channel?.removeEventListener("message", onMessage);
      };
    },
  },
  publish,
);

let calendarApi!: ReturnType<typeof createCalendar>;
export const productivity = createProductivity(
  productivityDb,
  publish,
  (id, expected, patch) => calendarApi.updateHabit(id, expected, patch),
);
export const goals = createGoals(goalsDb, publish);
export const reviews = createReviews(reviewsDb, publish);
export const plugins = createPluginPlatform(
  db,
  {
    get: (key) => preferences.get(key),
    set: (key, value) => preferences.set(key, value),
  },
  (url) => {
    window.open(url, "_blank", "noopener,noreferrer");
  },
  (profileId, record, w, h) =>
    workspace.addPluginWidget(profileId, record, w, h),
);
export const calendar = (calendarApi = createCalendar({
  database: calendarDb,
  alarms: sweepAlarmPort,
  notifications: productNotifications,
  completeTask: async (id, revision) => {
    const task = (await productivity.load()).tasks.find(
      (task) => task.id === id,
    );
    if (!task) throw new Error("Task not found");
    await productivity.saveTask(id, revision ?? task.revision, {
      status: "done",
    });
  },
}));

export const people = createPeople(peopleDb, publish, {
  syncFollowUp: (id) => calendar.syncFollowUp(id),
});
export const focus = createFocus(focusDb, publish);

export async function requestOptional(
  name: "bookmarks" | "notifications",
): Promise<PermissionOutcome> {
  if (!browser.permissions?.request) return "unsupported";
  try {
    const granted = await browser.permissions.request({ permissions: [name] });
    return granted ? "granted" : "denied";
  } catch (error) {
    const text = error instanceof Error ? error.message : String(error);
    if (/gesture|user input|dismiss|closed/i.test(text)) return "dismissed";
    return "failed";
  }
}
