import { beforeEach, describe, expect, it } from "vitest";
import { createCalendar } from "../../src/application/calendar";
import { createInbox } from "../../src/application/inbox";
import { createProductivity } from "../../src/application/productivity";
import {
  createWorkspace,
  memoryPreferences,
} from "../../src/application/workspace";
import {
  calendarDb,
  db,
  inboxDb,
  productivityDb,
} from "../../src/infrastructure/db";

beforeEach(async () => {
  if (!db.isOpen()) await db.open();
  await Promise.all([
    db.profiles.clear(),
    db.widgets.clear(),
    db.inboxItems.clear(),
    db.tasks.clear(),
    db.notes.clear(),
    db.events.clear(),
    db.reminderRules.clear(),
    db.notificationOccurrences.clear(),
    db.habits.clear(),
  ]);
});
async function harness() {
  const workspace = createWorkspace(memoryPreferences());
  const profile = (await workspace.load()).profiles[0];
  if (!profile) throw new Error("missing profile");
  const productivity = createProductivity(productivityDb);
  const calendar = createCalendar({
    database: calendarDb,
    now: () => Date.UTC(2026, 2, 8, 12),
    alarms: { schedule: async () => {}, clear: async () => {} },
    notifications: {
      permission: async () => "granted" as const,
      show: async () => "accepted" as const,
      clear: async () => {},
    },
  });
  return {
    profile,
    workspace,
    productivity,
    calendar,
    inbox: createInbox(inboxDb, () => {}, { productivity, calendar }),
  };
}

describe("AI Inbox persistence and conversion", () => {
  it("creates editable task, note, and event destinations through real services", async () => {
    const { profile, inbox, productivity, calendar } = await harness();
    const task = await inbox.create(
      profile.id,
      "Remember to call the dentist",
      "UTC",
    );
    const edited = await inbox.updateDraft(profile.id, task.id, task.revision, {
      kind: "task",
      title: "Call dentist",
      details: "Use the local list",
      today: true,
      priority: 3,
      dueDate: "2026-03-09",
    });
    const acceptedTask = await inbox.accept(
      profile.id,
      edited.id,
      edited.revision,
    );
    expect(
      (await productivity.load()).tasks.find(
        (row) => row.id === acceptedTask.destination?.id,
      ),
    ).toMatchObject({
      title: "Call dentist",
      priority: 3,
      dueDate: "2026-03-09",
    });
    const note = await inbox.create(
      profile.id,
      "Idea: document the local flow",
      "UTC",
    );
    const editedNote = await inbox.updateDraft(
      profile.id,
      note.id,
      note.revision,
      {
        kind: "note",
        title: "Document the local flow",
        content: "Keep it private.",
        tags: ["venus", "local"],
      },
    );
    const acceptedNote = await inbox.accept(
      profile.id,
      editedNote.id,
      editedNote.revision,
    );
    expect(
      (await productivity.load()).notes.find(
        (row) => row.id === acceptedNote.destination?.id,
      ),
    ).toMatchObject({
      title: "Document the local flow",
      tags: ["venus", "local"],
    });
    const source = await inbox.create(
      profile.id,
      "Meeting 2026-03-10 09:30",
      "America/New_York",
    );
    const eventDraft = await inbox.reclassify(
      profile.id,
      source.id,
      source.revision,
      "event",
      "America/New_York",
    );
    const acceptedEvent = await inbox.accept(
      profile.id,
      eventDraft.id,
      eventDraft.revision,
    );
    expect(
      (await calendar.list()).events.find(
        (row) => row.id === acceptedEvent.destination?.id,
      ),
    ).toMatchObject({
      title: "Meeting 2026-03-10 09:30",
      zoneId: "America/New_York",
    });
  });
  it("prevents duplicate conversion, supports reject/restore/undo, and keeps records after reopen", async () => {
    const { profile, inbox, productivity } = await harness();
    const source = await inbox.create(profile.id, "Buy tea", "UTC");
    const [first, second] = await Promise.allSettled([
      inbox.accept(profile.id, source.id, source.revision),
      inbox.accept(profile.id, source.id, source.revision),
    ]);
    expect([first.status, second.status]).toContain("fulfilled");
    const accepted = (await inbox.load(profile.id)).accepted[0];
    expect(accepted).toBeDefined();
    expect(
      (await productivity.load()).tasks.filter(
        (task) => task.id === accepted?.destination?.id,
      ),
    ).toHaveLength(1);
    await inbox.undo(profile.id, accepted!.id, accepted!.revision);
    expect((await inbox.load(profile.id)).undone).toHaveLength(1);
    expect(
      (await productivity.load()).tasks.find(
        (task) => task.id === accepted?.destination?.id,
      ),
    ).toBeUndefined();
    const rejected = await inbox.create(profile.id, "Maybe later", "UTC");
    const declined = await inbox.reject(
      profile.id,
      rejected.id,
      rejected.revision,
    );
    const restored = await inbox.restore(
      profile.id,
      declined.id,
      declined.revision,
    );
    db.close();
    await db.open();
    expect(
      (await inbox.load(profile.id)).pending.find(
        (item) => item.id === restored.id,
      ),
    ).toMatchObject({ content: "Maybe later" });
  });
  it("isolates profiles, keeps Inbox data when its singleton widget is removed, and rejects stale drafts", async () => {
    const { profile, workspace, inbox } = await harness();
    const row = await inbox.create(profile.id, "Local thought", "UTC");
    const widget = await workspace.addWidget(profile.id, "inbox");
    expect((await workspace.addWidget(profile.id, "inbox")).id).toBe(widget.id);
    await workspace.removeWidget(widget.id);
    expect((await workspace.addWidget(profile.id, "inbox")).id).not.toBe(
      widget.id,
    );
    expect(
      (await inbox.load(profile.id)).pending.map((item) => item.id),
    ).toContain(row.id);
    const other = await workspace.createProfile("minimal", "Separate inbox");
    expect((await inbox.load(other.id)).items).toHaveLength(0);
    await expect(
      inbox.updateDraft(profile.id, row.id, row.revision - 1, row.draft),
    ).rejects.toMatchObject({ code: "conflict" });
  });
});
