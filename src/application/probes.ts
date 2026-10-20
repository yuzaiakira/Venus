import { db, saveProbe } from "../infrastructure/db";
import {
  bookmarks,
  capabilities,
  permission,
  reconcileBackground,
} from "../infrastructure/browser";
export const inspectCapabilities = capabilities;
export const changePermission = permission;
export const testBookmarks = () => bookmarks.probe();
export const readProbeResults = () => db.probes.toArray();
export async function scheduleProbe() {
  const probe = await saveProbe({
    id: crypto.randomUUID(),
    dueAt: Date.now() + 60_000,
    state: "pending",
    native: "not_attempted",
  });
  await reconcileBackground();
  return probe;
}
