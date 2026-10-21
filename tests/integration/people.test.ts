import Dexie from "dexie";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createCalendar } from "../../src/application/calendar";
import { createPeople } from "../../src/application/people";
import {
  createWorkspace,
  memoryPreferences,
} from "../../src/application/workspace";
import { calendarDb, db, peopleDb } from "../../src/infrastructure/db";

const fixedNow = Date.UTC(2026, 2, 8, 12, 0, 0);
const alarms = {
  schedule: vi.fn(async () => {}),
  clear: vi.fn(async () => {}),
};
const notifications = {
  permission: vi.fn<() => Promise<"granted" | "denied" | "missing">>(
    async () => "granted",
  ),
  show: vi.fn(async () => "accepted" as const),
  clear: vi.fn(async () => {}),
};

beforeEach(async () => {
  vi.clearAllMocks();
  if (db.isOpen()) db.close();
  await Dexie.delete("Venus-p00");
  await db.open();
});

async function harness() {
  const workspace = createWorkspace(memoryPreferences());
  const snapshot = await workspace.load();
  const profile = snapshot.profiles[0];
  if (!profile) throw new Error("profile missing");
  const calendar = createCalendar({
    database: calendarDb,
    alarms,
    notifications,
    now: () => fixedNow,
  });
  const people = createPeople(peopleDb, () => {}, {
    syncFollowUp: (id) => calendar.syncFollowUp(id),
  });
  return { workspace, profile, calendar, people };
}

describe("People & Follow-ups persistence", () => {
  it("creates, edits, searches, archives and explicitly deletes a person's local cascade", async () => {
    const { profile, people } = await harness();
    const person = await people.createPerson(profile.id, {
      displayName: "Ari Orbit",
      organization: "Venus",
      role: "Design partner",
      email: "ari@example.test",
      phone: null,
      tags: ["design", "friend", "design"],
      relationshipNotes: "Prefer a short message.",
    });
    const edited = await people.updatePerson(person.id, person.revision, {
      role: "Advisor",
      tags: ["design", "advisor"],
    });
    expect((await people.searchPeople(profile.id, "advisor"))[0]?.id).toBe(
      person.id,
    );
    const followUp = await people.createFollowUp(profile.id, {
      personId: person.id,
      title: "Share prototype",
      dueDate: "2026-03-08",
      dueTime: "09:00",
      timeZone: "America/New_York",
      priority: "high",
      contactMethod: "message",
      reminderEnabled: true,
    });
    await people.recordInteraction(profile.id, {
      personId: person.id,
      followUpId: followUp.id,
      kind: "promise",
      body: "Send after review.",
      occurredAt: "2026-03-08T08:00:00.000Z",
    });
    await expect(
      people.deletePerson(person.id, edited.revision, false),
    ).rejects.toThrow();
    await people.deletePerson(person.id, edited.revision, true);
    expect(await db.people.get(person.id)).toBeUndefined();
    expect(await db.followUps.get(followUp.id)).toBeUndefined();
    expect(
      (await db.interactions.toArray()).filter(
        (row) => row.personId === person.id,
      ),
    ).toHaveLength(0);
    expect(
      (await db.reminderRules.toArray()).filter(
        (row) => row.followUpId === followUp.id,
      ),
    ).toHaveLength(0);
  });

  it("materializes one timezone-aware reminder, survives permission denial, and completes exactly once", async () => {
    const { profile, calendar, people } = await harness();
    const person = await people.createPerson(profile.id, {
      displayName: "Daily contact",
      organization: null,
      role: null,
      email: null,
      phone: null,
      tags: [],
      relationshipNotes: "",
    });
    const followUp = await people.createFollowUp(profile.id, {
      personId: person.id,
      title: "Call after DST shift",
      dueDate: "2026-03-08",
      dueTime: "08:00",
      timeZone: "America/New_York",
      priority: "normal",
      contactMethod: "phone",
      reminderEnabled: true,
    });
    await calendar.syncFollowUp(followUp.id);
    const rules = (await db.reminderRules.toArray()).filter(
      (rule) => rule.followUpId === followUp.id,
    );
    const initial = (await db.notificationOccurrences.toArray()).filter(
      (row) => row.ownerId === followUp.id,
    );
    expect(rules).toHaveLength(1);
    expect(initial).toHaveLength(1);
    expect(initial[0]).toMatchObject({
      sourceKind: "followup",
      internalStatus: "pending",
      fireAtUTC: Date.UTC(2026, 2, 8, 12, 0, 0),
    });
    notifications.permission.mockResolvedValueOnce("denied");
    await calendar.reconcile(false);
    const due = (await db.notificationOccurrences.toArray()).find(
      (row) => row.ownerId === followUp.id && row.internalStatus === "due",
    );
    expect(due?.nativeApiStatus).toBe("denied");
    if (!due) throw new Error("follow-up occurrence missing");
    await Promise.all([
      calendar.complete(due.idempotencyKey),
      calendar.complete(due.idempotencyKey),
    ]);
    const saved = await db.followUps.get(followUp.id);
    expect(saved).toMatchObject({ status: "completed" });
    expect(
      (await db.notificationOccurrences.toArray()).filter(
        (row) =>
          row.ownerId === followUp.id && row.internalStatus === "completed",
      ),
    ).toHaveLength(1);
    expect(
      (await db.interactions.toArray()).filter(
        (row) => row.followUpId === followUp.id,
      ),
    ).toHaveLength(0);
  });

  it("snoozes a notification through the shared calendar lifecycle without losing the follow-up", async () => {
    const { profile, calendar, people } = await harness();
    const person = await people.createPerson(profile.id, {
      displayName: "Snooze safely",
      organization: null,
      role: null,
      email: null,
      phone: null,
      tags: [],
      relationshipNotes: "",
    });
    const followUp = await people.createFollowUp(profile.id, {
      personId: person.id,
      title: "Move this reminder",
      dueDate: "2026-03-08",
      dueTime: "08:00",
      timeZone: "America/New_York",
      priority: "normal",
      contactMethod: "message",
      reminderEnabled: true,
    });
    await calendar.reconcile(false);
    const due = (await db.notificationOccurrences.toArray()).find(
      (row) => row.ownerId === followUp.id && row.internalStatus === "due",
    );
    if (!due) throw new Error("due follow-up occurrence missing");
    await calendar.snooze(due.idempotencyKey, 30);
    const snoozed = await db.followUps.get(followUp.id);
    expect(snoozed?.snoozedUntilUTC).toBe(fixedNow + 30 * 60_000);
    expect(
      (await db.notificationOccurrences.get(due.idempotencyKey))
        ?.internalStatus,
    ).toBe("snoozed");
    expect(
      (await db.notificationOccurrences.toArray()).filter(
        (row) =>
          row.ownerId === followUp.id && row.internalStatus === "pending",
      ),
    ).toHaveLength(1);
  });

  it("handles snooze, edit/disable cleanup, profile isolation, widget singleton and reopen persistence", async () => {
    const { workspace, profile, calendar, people } = await harness();
    const person = await people.createPerson(profile.id, {
      displayName: "Weekly contact",
      organization: null,
      role: null,
      email: null,
      phone: null,
      tags: ["weekly"],
      relationshipNotes: "",
    });
    const followUp = await people.createFollowUp(profile.id, {
      personId: person.id,
      title: "Monday follow-up",
      dueDate: "2026-03-09",
      dueTime: "09:00",
      timeZone: "America/New_York",
      priority: "low",
      contactMethod: "email",
      reminderEnabled: true,
    });
    const competingEdits = await Promise.allSettled([
      people.updateFollowUp(followUp.id, followUp.revision, {
        title: "First edit",
      }),
      people.updateFollowUp(followUp.id, followUp.revision, {
        title: "Second edit",
      }),
    ]);
    expect(
      competingEdits.filter((item) => item.status === "fulfilled"),
    ).toHaveLength(1);
    expect(
      competingEdits.filter((item) => item.status === "rejected"),
    ).toHaveLength(1);
    const current = await db.followUps.get(followUp.id);
    if (!current) throw new Error("updated follow-up missing");
    const snoozed = await people.postponeFollowUp(
      current.id,
      current.revision,
      Date.now() + 3_600_000,
    );
    expect(
      (await people.load(profile.id, "2026-03-08", fixedNow)).snoozed[0]?.id,
    ).toBe(snoozed.id);
    const edited = await people.updateFollowUp(snoozed.id, snoozed.revision, {
      reminderEnabled: false,
      dueTime: null,
    });
    expect(
      (await db.reminderRules.toArray()).filter(
        (rule) => rule.followUpId === edited.id,
      ),
    ).toHaveLength(0);
    expect(
      (await db.notificationOccurrences.toArray()).filter(
        (row) =>
          row.ownerId === edited.id &&
          ["pending", "due"].includes(row.internalStatus),
      ),
    ).toHaveLength(0);
    const other = await workspace.createProfile("minimal", "Other");
    expect((await people.load(other.id, "2026-03-08")).people).toHaveLength(0);
    const layoutBefore = (await workspace.load()).widgets
      .filter((widget) => widget.profileId === profile.id)
      .map(({ id, x, y, w, h }) => ({ id, x, y, w, h }));
    const widget = await workspace.addWidget(profile.id, "people");
    const duplicate = await workspace.addWidget(profile.id, "people");
    expect(duplicate.id).toBe(widget.id);
    await workspace.removeWidget(widget.id);
    expect(
      (await workspace.load()).widgets
        .filter((widget) => widget.profileId === profile.id)
        .map(({ id, x, y, w, h }) => ({ id, x, y, w, h })),
    ).toEqual(layoutBefore);
    expect((await people.load(profile.id, "2026-03-08")).followUps[0]?.id).toBe(
      edited.id,
    );
    db.close();
    await db.open();
    expect(
      (await people.load(profile.id, "2026-03-08")).followUps[0],
    ).toMatchObject({ id: edited.id, reminderEnabled: false });
    await calendar.reconcile(false);
  });
});
