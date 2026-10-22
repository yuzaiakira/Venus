import { beforeEach, describe, expect, it } from "vitest";
import { createCalendar } from "../../src/application/calendar";
import { createFinance } from "../../src/application/finance";
import { createFocus } from "../../src/application/focus";
import { createGoals } from "../../src/application/goals";
import { createInbox } from "../../src/application/inbox";
import { createPeople } from "../../src/application/people";
import { createProductivity } from "../../src/application/productivity";
import { createReviews } from "../../src/application/reviews";
import {
  createWeather,
  type WeatherProvider,
} from "../../src/application/weather";
import {
  createWorkspace,
  memoryPreferences,
} from "../../src/application/workspace";
import { reorderPlacement } from "../../src/domain/dashboard";
import { parseSignedMinor } from "../../src/domain/finance";
import {
  emptyDocument,
  previewNotes,
  previewTodayTasks,
} from "../../src/domain/productivity";
import {
  calendarDb,
  db,
  financeDb,
  focusDb,
  goalsDb,
  inboxDb,
  peopleDb,
  productivityDb,
  reviewsDb,
  weatherDb,
} from "../../src/infrastructure/db";

const fixedNow = Date.UTC(2026, 2, 8, 13, 0, 0);

function calendar(now = fixedNow) {
  return createCalendar({
    database: calendarDb,
    alarms: { schedule: async () => {}, clear: async () => {} },
    notifications: {
      permission: async () => "granted" as const,
      show: async () => "accepted" as const,
      clear: async () => {},
    },
    now: () => now,
  });
}

async function clearWorkspaceData() {
  if (!db.isOpen()) await db.open();
  await Promise.all([
    db.probes.clear(),
    db.profiles.clear(),
    db.widgets.clear(),
    db.sharedItems.clear(),
    db.assets.clear(),
    db.notes.clear(),
    db.noteDrafts.clear(),
    db.folders.clear(),
    db.tasks.clear(),
    db.habits.clear(),
    db.goals.clear(),
    db.milestones.clear(),
    db.goalRelations.clear(),
    db.weeklyReviews.clear(),
    db.reviewSchedules.clear(),
    db.reviewHistory.clear(),
    db.people.clear(),
    db.followUps.clear(),
    db.interactions.clear(),
    db.focusDeferrals.clear(),
    db.inboxItems.clear(),
    db.weatherProfiles.clear(),
    db.weatherLocations.clear(),
    db.weatherForecasts.clear(),
    db.commutePlans.clear(),
    db.financeAccounts.clear(),
    db.financeCategories.clear(),
    db.financeTransactions.clear(),
    db.financeBudgets.clear(),
    db.financeBills.clear(),
    db.financeBillPayments.clear(),
    db.localBookmarks.clear(),
    db.bookmarkSnapshots.clear(),
    db.events.clear(),
    db.reminderRules.clear(),
    db.notificationOccurrences.clear(),
    db.timerSessions.clear(),
    db.quietHours.clear(),
    db.pluginPackages.clear(),
    db.pluginInstanceData.clear(),
  ]);
}

beforeEach(clearWorkspaceData);

describe("cross-widget local workflows", () => {
  it("persists dashboard customization and makes captured tasks, notes, and events available to dashboard data", async () => {
    const workspace = createWorkspace(memoryPreferences());
    const snapshot = await workspace.load();
    const profile = snapshot.profiles[0];
    if (!profile) throw new Error("missing profile");
    const productivity = createProductivity(productivityDb);
    const schedule = calendar();

    const capture = await workspace.addWidget(profile.id, "capture");
    expect((await workspace.addWidget(profile.id, "capture")).id).toBe(
      capture.id,
    );
    const briefing = await workspace.addWidget(profile.id, "briefing");
    await workspace.removeWidget(capture.id);
    const restoredCapture = await workspace.addWidget(profile.id, "capture");
    expect(restoredCapture.id).not.toBe(capture.id);

    const task = await productivity.createTask(
      "Submit release notes",
      "",
      true,
    );
    const note = await productivity.createNote({
      title: "Release notes draft",
      body: emptyDocument("Local only"),
      folderId: null,
    });
    const event = await schedule.createEvent({
      title: "Release review",
      basis: "gregorian",
      allDay: false,
      localDate: { calendar: "gregorian", year: 2026, month: 3, day: 8 },
      wall: { hour: 15, minute: 0, second: 0 },
      zoneId: "UTC",
      offsetMinutes: [],
    });
    const current = await workspace.load();
    const placements = current.widgets
      .filter((row) => row.profileId === profile.id)
      .map(({ id, x, y, w, h }) => ({ id, x, y, w, h }));
    const reordered = reorderPlacement(
      placements,
      briefing.id,
      restoredCapture.id,
    );
    await workspace.savePlacements(profile.id, reordered);

    const library = await productivity.load();
    expect(previewTodayTasks(library.tasks).map((row) => row.id)).toContain(
      task.id,
    );
    expect(previewNotes(library.notes).map((row) => row.id)).toContain(note.id);
    expect((await schedule.occurrences(event.id))[0]?.epochMs).toBe(
      Date.UTC(2026, 2, 8, 15),
    );

    db.close();
    await db.open();
    const reopened = await workspace.load();
    expect(
      reopened.widgets.filter(
        (row) => row.profileId === profile.id && row.widgetType === "capture",
      ),
    ).toHaveLength(1);
    const savedBriefing = reopened.widgets.find(
      (row) => row.id === briefing.id,
    );
    const expectedBriefing = reordered.find((row) => row.id === briefing.id);
    expect(savedBriefing).toBeTruthy();
    expect(expectedBriefing).toBeTruthy();
    expect(savedBriefing).toMatchObject(expectedBriefing!);
    expect(
      (await productivity.load()).tasks.some((row) => row.id === task.id),
    ).toBe(true);
  });

  it("keeps goals, knowledge reviews, and people records connected to real task, habit, and note data", async () => {
    const workspace = createWorkspace(memoryPreferences());
    const profile = (await workspace.load()).profiles[0];
    if (!profile) throw new Error("missing profile");
    const productivity = createProductivity(productivityDb);
    const goals = createGoals(goalsDb);
    const reviews = createReviews(reviewsDb);
    const people = createPeople(peopleDb);

    const task = await productivity.createTask("Ship review");
    const doneTask = await productivity.saveTask(task.id, task.revision, {
      status: "done",
    });
    const habit = await productivity.createHabit("Read", "daily");
    const checkedIn = await productivity.toggleHabit(
      habit.id,
      habit.revision,
      "2026-03-08",
    );
    const goal = await goals.createGoal(profile.id, {
      title: "Release confidence",
      description: "Use connected local progress",
      startDate: "2026-03-01",
      targetDate: "2026-03-31",
      progress: {
        mode: "habitCheckIns",
        target: 1,
        periodStart: "2026-03-01",
        periodEnd: "2026-03-31",
      },
    });
    await goals.linkRecord(goal.id, goal.revision, "task", doneTask.id);
    await goals.linkRecord(goal.id, goal.revision, "habit", checkedIn.id);
    expect(
      (await goals.load(profile.id)).goals[0]?.progressSummary,
    ).toMatchObject({ current: 1, target: 1, percent: 100 });

    const note = await productivity.createNote({
      title: "What we learned",
      body: emptyDocument("Review the local evidence"),
      folderId: null,
    });
    const enrolled = await reviews.enroll(profile.id, note.id, "2026-03-08");
    await reviews.submitRating(
      enrolled.id,
      enrolled.revision,
      "good",
      "2026-03-08",
    );
    expect(
      (await reviews.load(profile.id, "2026-03-08")).schedules[0],
    ).toMatchObject({
      noteId: note.id,
      history: [expect.objectContaining({ outcome: "good" })],
    });

    const person = await people.createPerson(profile.id, {
      displayName: "Ari",
      organization: "Venus",
      role: "Reviewer",
      email: "ari@example.com",
      phone: null,
      tags: ["release"],
      relationshipNotes: "Local review partner",
    });
    const followUp = await people.createFollowUp(profile.id, {
      personId: person.id,
      title: "Share release notes",
      dueDate: "2026-03-09",
      dueTime: null,
      timeZone: "UTC",
      priority: "normal",
      contactMethod: "email",
      reminderEnabled: false,
    });
    await people.recordInteraction(profile.id, {
      personId: person.id,
      followUpId: followUp.id,
      kind: "note",
      body: "Draft shared locally",
      occurredAt: "2026-03-08T13:00:00.000Z",
    });
    expect(
      (await people.load(profile.id, "2026-03-08")).people[0],
    ).toMatchObject({
      id: person.id,
      followUps: [expect.objectContaining({ id: followUp.id })],
      interactions: [expect.objectContaining({ body: "Draft shared locally" })],
    });

    db.close();
    await db.open();
    expect((await goals.load(profile.id)).goals[0]?.relations).toHaveLength(2);
    expect(
      (await reviews.load(profile.id, "2026-03-08")).schedules,
    ).toHaveLength(1);
    expect(
      (await people.load(profile.id, "2026-03-08")).followUps,
    ).toHaveLength(1);
  });

  it("keeps local focus, Inbox, Weather consent, and Finance data independent and persistent", async () => {
    const workspace = createWorkspace(memoryPreferences());
    const profile = (await workspace.load()).profiles[0];
    if (!profile) throw new Error("missing profile");
    const productivity = createProductivity(productivityDb);
    const schedule = calendar();
    const focus = createFocus(focusDb);
    const inbox = createInbox(inboxDb, () => {}, {
      productivity,
      calendar: schedule,
    });
    let searches = 0;
    let forecasts = 0;
    const provider: WeatherProvider = {
      async search() {
        searches += 1;
        return [
          { label: "Tehran", country: "IR", latitude: 35.68, longitude: 51.41 },
        ];
      },
      async forecast() {
        forecasts += 1;
        return {
          timezone: "Asia/Tehran",
          current: {
            temperatureC: 21,
            windSpeedKph: 5,
            weatherCode: 1,
            observedAt: fixedNow,
          },
          days: [
            {
              date: "2026-03-08",
              temperatureMaxC: 23,
              temperatureMinC: 12,
              precipitationProbability: 0,
              precipitationMm: 0,
              windSpeedKph: 7,
              weatherCode: 1,
            },
          ],
        };
      },
    };
    const weather = createWeather(weatherDb, () => {}, {
      provider,
      calendar: schedule,
      now: () => fixedNow,
    });
    const finance = createFinance(financeDb);

    const task = await productivity.createTask("Focus on release", "", true);
    const ranked = await productivity.saveTask(task.id, task.revision, {
      priority: 3,
      dueDate: "2026-03-08",
      focusRank: 1,
    });
    await schedule.createEvent({
      title: "Existing conflict",
      basis: "gregorian",
      allDay: false,
      localDate: { calendar: "gregorian", year: 2026, month: 3, day: 8 },
      wall: { hour: 14, minute: 0, second: 0 },
      zoneId: "UTC",
      offsetMinutes: [],
    });
    const recommendation = await focus.load(profile.id, "UTC", fixedNow);
    expect(recommendation.suggestions[0]?.task.id).toBe(ranked.id);
    expect(recommendation.conflicts.map((row) => row.title)).toContain(
      "Existing conflict",
    );
    await schedule.startTimer({ mode: "pomodoro", label: ranked.title });
    expect(
      (await focus.load(profile.id, "UTC", fixedNow)).activeTimer,
    ).toMatchObject({ status: "running", label: ranked.title });

    const submitted = await inbox.create(
      profile.id,
      "Buy release snacks",
      "UTC",
    );
    const draft = await inbox.updateDraft(
      profile.id,
      submitted.id,
      submitted.revision,
      {
        kind: "task",
        title: "Buy release snacks",
        details: "Keep local",
        today: true,
        priority: 2,
        dueDate: "2026-03-08",
      },
    );
    const accepted = await inbox.accept(profile.id, draft.id, draft.revision);
    expect(
      (await productivity.load()).tasks.some(
        (row) => row.id === accepted.destination?.id,
      ),
    ).toBe(true);
    await inbox.undo(profile.id, accepted.id, accepted.revision);
    expect(
      (await productivity.load()).tasks.some(
        (row) => row.id === accepted.destination?.id,
      ),
    ).toBe(false);

    const initialWeather = await weather.load(profile.id);
    await expect(weather.search(profile.id, "Tehran")).rejects.toMatchObject({
      code: "invalidInput",
    });
    expect(searches).toBe(0);
    const consent = await weather.grantNetwork(
      profile.id,
      initialWeather.preference.revision,
      "test-commercial-key",
    );
    const locations = await weather.search(profile.id, "Tehran");
    await weather.setLocation(profile.id, locations[0]!, "manual");
    await weather.refresh(profile.id, "Asia/Tehran");
    expect({ searches, forecasts }).toEqual({ searches: 1, forecasts: 1 });
    expect(consent.apiKey).toBe("test-commercial-key");

    const account = await finance.createAccount(profile.id, {
      name: "Cash",
      type: "cash",
      currency: "USD",
      openingBalanceMinor: parseSignedMinor("-5.00", "USD"),
    });
    const category = await finance.createCategory(profile.id, {
      name: "Food",
      kind: "expense",
    });
    await finance.createTransaction(profile.id, {
      kind: "expense",
      amountMinor: 250,
      currency: "USD",
      accountId: account.id,
      toAccountId: null,
      categoryId: category.id,
      date: "2026-03-08",
      description: "Snacks",
    });
    expect((await finance.load(profile.id, "2026-03")).summaries).toEqual([
      expect.objectContaining({
        currency: "USD",
        expenseMinor: 250,
        balanceMinor: -750,
      }),
    ]);

    db.close();
    await db.open();
    expect(
      (await focus.load(profile.id, "UTC", fixedNow)).activeTimer?.status,
    ).toBe("running");
    expect((await weather.load(profile.id)).forecast?.locationId).toBeTruthy();
    expect((await finance.load(profile.id, "2026-03")).accounts).toHaveLength(
      1,
    );
  });
});
