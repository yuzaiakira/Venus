import { browser } from "wxt/browser";
import {
  safeUrl,
  type AlarmPort,
  type BookmarkPort,
  type NotificationPort,
  type PreferencePort,
  type ProbeSessionPort,
} from "../domain/foundation";
export const alarms: AlarmPort = {
  schedule: async (id, when) => {
    await browser.alarms.create(id, { when });
  },
  list: async () => (await browser.alarms.getAll()).map((a) => a.name),
};
export const notifications: NotificationPort = {
  async show(id) {
    if (
      !(await browser.permissions.contains({ permissions: ["notifications"] }))
    )
      return "blocked";
    try {
      await browser.notifications.create(id, {
        type: "basic",
        iconUrl: browser.runtime.getURL("/icons/icon.png"),
        title: "Venus",
        message: "P00 test / آزمون P00",
      });
      return "api_accepted"; // API success does not prove OS display.
    } catch {
      return "failed";
    }
  },
};
export const bookmarks: BookmarkPort = {
  hasPermission: () =>
    browser.permissions.contains({ permissions: ["bookmarks"] }),
  async probe() {
    if (!(await this.hasPermission())) throw new Error("permissionDenied");
    await browser.bookmarks.getTree();
    const node = await browser.bookmarks.create({
      title: "Venus P00 synthetic fixture",
      url: safeUrl("https://example.invalid/"),
    });
    try {
      await browser.bookmarks.update(node.id, {
        title: "Venus P00 updated fixture",
      });
    } finally {
      await browser.bookmarks.remove(node.id);
    }
  },
};
export const preferences: PreferencePort = {
  get: async (key) => (await browser.storage.local.get(key))[key] as unknown,
  set: async (key, value) => {
    await browser.storage.local.set({ [key]: value });
  },
};
const sessionKey = "p00.session.active";
export const probeSession: ProbeSessionPort = {
  active: async () =>
    (await browser.storage.session.get(sessionKey))[sessionKey] === true,
  begin: async () => {
    await browser.storage.session.set({ [sessionKey]: true });
  },
};
export const sweepAlarmPort = {
  schedule: async (at: number) => {
    await browser.alarms.create("venus-sweep", { when: at });
  },
  clear: async () => {
    await browser.alarms.clear("venus-sweep");
  },
};
export const productNotifications = {
  async permission(): Promise<"granted" | "denied" | "missing"> {
    const granted = await browser.permissions.contains({
      permissions: ["notifications"],
    });
    if (!granted) return "missing";
    return "granted";
  },
  async show(id: string, title: string) {
    try {
      await browser.notifications.create(id, {
        type: "basic" as const,
        iconUrl: browser.runtime.getURL("/icons/icon.png"),
        title,
        message: title,
      });
      return "accepted" as const;
    } catch {
      return "rejected" as const;
    }
  },
  async clear(id: string) {
    await browser.notifications.clear(id);
  },
};
export async function reconcileBackground() {
  await browser.runtime.sendMessage("p00.reconcile");
}
export async function permission(
  name: "bookmarks" | "notifications",
  grant: boolean,
) {
  return grant
    ? browser.permissions.request({ permissions: [name] })
    : browser.permissions.remove({ permissions: [name] });
}
export async function capabilities() {
  return {
    target: import.meta.env.BROWSER,
    manifest: browser.runtime.getManifest().manifest_version,
    bookmarks: await bookmarks.hasPermission(),
    notifications: await browser.permissions.contains({
      permissions: ["notifications"],
    }),
    homepage:
      browser.runtime.getManifest().chrome_settings_overrides?.homepage ?? null,
  };
}
