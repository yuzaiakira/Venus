import { beforeEach, describe, expect, it, vi } from "vitest";
import { createProbeScheduler } from "../../src/application/scheduler";
import { createProbeLifecycle } from "../../src/application/lifecycle";
import {
  db,
  claimProbe,
  recoverProbes,
  saveProbe,
} from "../../src/infrastructure/db";
const fixture = {
  id: "f535d2b1-f815-41d9-9e61-2d2518ce30b8",
  dueAt: 1000,
  state: "pending" as const,
  native: "not_attempted" as const,
};
const alarms = { schedule: vi.fn(async () => {}), list: vi.fn(async () => []) };
const notifications = { show: vi.fn(async () => "blocked" as const) };
const scheduler = createProbeScheduler(
  {
    recover: recoverProbes,
    claim: claimProbe,
    recordNative: async (id, native) => {
      await db.probes.update(id, { native });
    },
  },
  alarms,
  notifications,
);
beforeEach(async () => {
  await db.probes.clear();
  vi.clearAllMocks();
  await saveProbe(fixture);
});
describe("durable P00 alarm spike (injected API doubles, not browser proof)", () => {
  it("recreates pending alarms after DB reopen without losing the due time", async () => {
    db.close();
    await db.open();
    await scheduler.restore(500);
    expect(alarms.schedule).toHaveBeenCalledWith(fixture.id, 1000);
  });
  it("records missed due times after shutdown without a native flood", async () => {
    await scheduler.restore(2000);
    expect((await db.probes.get(fixture.id))?.state).toBe("missed");
    expect(alarms.schedule).not.toHaveBeenCalled();
    expect(notifications.show).not.toHaveBeenCalled();
  });
  it("does not consume a due alarm during worker wake reconciliation", async () => {
    // The worker can reload after the deadline before onAlarm is dispatched.
    await scheduler.restore(2000, "wake");
    await scheduler.fire(fixture.id);
    expect(notifications.show).toHaveBeenCalledTimes(1);
    expect(await db.probes.get(fixture.id)).toMatchObject({
      state: "due",
      native: "blocked",
    });
  });
  it("serializes cold alarm delivery behind new-session missed recovery", async () => {
    const begin = vi.fn(async () => {});
    const lifecycle = createProbeLifecycle(
      scheduler,
      { active: async () => false, begin },
      () => 2000,
    );
    await Promise.all([lifecycle.fire(fixture.id), lifecycle.restore()]);
    expect((await db.probes.get(fixture.id))?.state).toBe("missed");
    expect(notifications.show).not.toHaveBeenCalled();
    expect(begin).toHaveBeenCalledTimes(1);
  });
  it("allows one due attempt when a suspended worker wakes in the same session", async () => {
    const lifecycle = createProbeLifecycle(
      scheduler,
      { active: async () => true, begin: async () => {} },
      () => 2000,
    );
    await Promise.all([
      lifecycle.restore(),
      lifecycle.fire(fixture.id),
      lifecycle.fire(fixture.id),
    ]);
    expect(notifications.show).toHaveBeenCalledTimes(1);
    expect(await db.probes.get(fixture.id)).toMatchObject({
      state: "due",
      native: "blocked",
    });
  });
  it("fails visibly without claiming an alarm when session initialization fails", async () => {
    const lifecycle = createProbeLifecycle(scheduler, {
      active: async () => {
        throw new Error("synthetic session failure");
      },
      begin: async () => {},
    });
    await expect(lifecycle.fire(fixture.id)).rejects.toThrow(
      "synthetic session failure",
    );
    expect((await db.probes.get(fixture.id))?.state).toBe("pending");
    expect(notifications.show).not.toHaveBeenCalled();
  });
  it("deduplicates simultaneous deliveries and persists denied native state", async () => {
    await Promise.all([scheduler.fire(fixture.id), scheduler.fire(fixture.id)]);
    expect(notifications.show).toHaveBeenCalledTimes(1);
    expect(await db.probes.get(fixture.id)).toMatchObject({
      state: "due",
      native: "blocked",
    });
  });
  it("does not overwrite an already claimed result during restart reconciliation", async () => {
    await scheduler.fire(fixture.id);
    await scheduler.restore(2000);
    expect(await db.probes.get(fixture.id)).toMatchObject({
      state: "due",
      native: "blocked",
    });
  });
  it("persists native API failure while retaining the internal due result", async () => {
    const broken = createProbeScheduler(
      {
        recover: recoverProbes,
        claim: claimProbe,
        recordNative: async (id, native) => {
          await db.probes.update(id, { native });
        },
      },
      alarms,
      {
        show: async () => {
          throw new Error("synthetic denied");
        },
      },
    );
    await broken.fire(fixture.id);
    expect(await db.probes.get(fixture.id)).toMatchObject({
      state: "due",
      native: "failed",
    });
  });
  it("invalid writes preserve the live persisted fixture", async () => {
    await expect(saveProbe({ ...fixture, dueAt: -1 })).rejects.toThrow();
    expect(await db.probes.get(fixture.id)).toEqual(fixture);
  });
});
