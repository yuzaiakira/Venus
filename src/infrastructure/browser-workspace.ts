import { browser } from "wxt/browser";
import { createCalendar } from "../application/calendar";
import { createProductivity } from "../application/productivity";
import { calendarDb, db, productivityDb } from "./db";
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
      return () => {
        localListeners.delete(listener);
        browser.storage.onChanged.removeListener(onChanged);
        channel?.removeEventListener("message", onMessage);
      };
    },
  },
  publish,
);

export const productivity = createProductivity(productivityDb, publish);
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
export const calendar = createCalendar({
  database: calendarDb,
  alarms: sweepAlarmPort,
  notifications: productNotifications,
  completeTask: async (id, revision) => {
    await productivity.saveTask(id, revision, { status: "done" });
  },
});

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
