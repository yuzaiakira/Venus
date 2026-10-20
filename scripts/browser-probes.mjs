// Reviewed test code executed only in the disposable extension-owned page.
// Optional permissions are observed, never silently granted by the harness.
export async function browserProbes() {
  const api = globalThis.browser ?? globalThis.chrome;
  if (!api?.runtime?.id) throw new Error("Not an installed extension context");
  const results = {};
  const key = "p00.synthetic.preference";
  await api.storage.local.set({ [key]: "fixture" });
  if ((await api.storage.local.get(key))[key] !== "fixture")
    throw new Error("storage roundtrip failed");
  await api.storage.local.remove(key);
  results.storage = "PASS";
  const alarm = "p00.synthetic.api-probe";
  await api.alarms.create(alarm, { when: Date.now() + 120000 });
  if (!(await api.alarms.getAll()).some((item) => item.name === alarm))
    throw new Error("Alarm API create/list failed");
  await api.alarms.clear(alarm);
  results.alarmCreateListClear = "PASS";
  if (await api.permissions.contains({ permissions: ["bookmarks"] })) {
    await api.bookmarks.getTree();
    const node = await api.bookmarks.create({
      title: "Venus smoke synthetic fixture",
      url: "https://example.invalid/",
    });
    try {
      await api.bookmarks.update(node.id, {
        title: "Venus smoke updated fixture",
      });
    } finally {
      await api.bookmarks.remove(node.id);
    }
    results.bookmarks = "PASS_GRANTED_SYNTHETIC_CRUD";
  } else results.bookmarks = "DENIED_OBSERVED; GRANT_REVOKE_NOT_RUN";
  if (await api.permissions.contains({ permissions: ["notifications"] })) {
    try {
      const id = await api.notifications.create("p00.synthetic.native", {
        type: "basic",
        iconUrl: api.runtime.getURL("icons/icon.png"),
        title: "Venus P00",
        message: "Synthetic browser API test",
      });
      await api.notifications.clear(id);
      results.notifications = "API_ACCEPTED; OS_DISPLAY_NOT_VERIFIED";
    } catch {
      results.notifications = "API_FAILED; OS_DISPLAY_NOT_VERIFIED";
    }
  } else results.notifications = "DENIED_OBSERVED; GRANT_REVOKE_NOT_RUN";
  return results;
}
