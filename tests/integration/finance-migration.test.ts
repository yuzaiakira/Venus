import Dexie from "dexie";
import { expect, it } from "vitest";

it("additively upgrades a realistic v14 workspace to v15 without losing existing module records", async () => {
  const { createFinance } = await import("../../src/application/finance");
  const { db, financeDb } = await import("../../src/infrastructure/db");
  if (db.isOpen()) db.close();
  await Dexie.delete("Venus-p00");
  const financeTables = [
    "financeAccounts",
    "financeCategories",
    "financeTransactions",
    "financeBudgets",
    "financeBills",
    "financeBillPayments",
  ];
  const stores = Object.fromEntries(
    db.tables
      .filter((table) => !financeTables.includes(table.name))
      .map((table) => [
        table.name,
        [
          table.schema.primKey.src,
          ...table.schema.indexes.map((index) => index.src),
        ]
          .filter(Boolean)
          .join(", "),
      ]),
  );
  const legacy = new Dexie("Venus-p00");
  legacy.version(14).stores(stores);
  const profileId = "51515151-5151-4151-8151-515151515151";
  const weatherId = "52525252-5252-4252-8252-525252525252";
  const widgetId = "53535353-5353-4353-8353-535353535353";
  const noteId = "54545454-5454-4454-8454-545454545454";
  const taskId = "55555555-5555-4555-8555-555555555555";
  const eventId = "56565656-5656-4565-8565-565656565656";
  const habitId = "57575757-5757-4575-8575-575757575757";
  const ruleId = "58585858-5858-4585-8585-585858585858";
  const goalId = "59595959-5959-4595-8595-595959595959";
  const milestoneId = "60606060-6060-4060-8060-606060606060";
  const scheduleId = "61616161-6161-4161-8161-616161616161";
  const personId = "62626262-6262-4262-8262-626262626262";
  const followUpId = "63636363-6363-4363-8363-636363636363";
  const inboxId = "64646464-6464-4464-8464-646464646464";
  const stamp = {
    revision: 4,
    createdAt: "2026-10-22T00:00:00.000Z",
    updatedAt: "2026-10-22T00:00:00.000Z",
  };
  await legacy.table("profiles").put({
    id: profileId,
    title: "Kept v14",
    preset: "minimal",
    themeMode: null,
    wallpaper: null,
    blurPx: null,
    glassAlpha: null,
    accent: null,
    ...stamp,
  });
  await legacy.table("widgets").put({
    id: widgetId,
    profileId,
    widgetType: "weather",
    x: 0,
    y: 0,
    w: 1,
    h: 1,
    visible: true,
    settings: {},
    ...stamp,
  });
  await legacy.table("weatherProfiles").put({
    id: weatherId,
    profileId,
    provider: "open-meteo-commercial",
    networkConsent: "revoked",
    deviceLocationConsent: "unset",
    consentVersion: 1,
    providerTermsAccepted: false,
    apiKey: null,
    ...stamp,
  });
  await legacy.table("notes").put({
    id: noteId,
    title: "Keep note",
    body: { version: 1, content: [] },
    folderId: null,
    tags: ["migration"],
    sortIndex: 0,
    pinned: true,
    archived: false,
    trashedAt: null,
    ...stamp,
  });
  await legacy.table("tasks").put({
    id: taskId,
    title: "Keep task",
    details: "Existing task record",
    status: "open",
    column: "todo",
    sortIndex: 0,
    today: true,
    todayOrder: 0,
    labels: ["migration"],
    checklist: [],
    priority: 2,
    dueDate: "2026-10-22",
    eventId: null,
    focusRank: 1,
    completedAt: null,
    ...stamp,
  });
  await legacy.table("events").put({
    id: eventId,
    title: "Keep event",
    description: "Existing calendar event",
    calendarBasis: "gregorian",
    allDay: false,
    localDate: { calendar: "gregorian", year: 2026, month: 10, day: 22 },
    wall: { hour: 9, minute: 0, second: 0 },
    zoneId: "UTC",
    foldPolicy: "earlier",
    recurrenceSpec: null,
    exclusions: [],
    overrides: {},
    generationCursor: null,
    ...stamp,
  });
  await legacy.table("habits").put({
    id: habitId,
    title: "Keep habit",
    frequency: "daily",
    reminder: { enabled: true, time: "09:00", timeZone: "UTC", weekdays: [] },
    checkIns: ["2026-10-21"],
    ...stamp,
  });
  await legacy.table("reminderRules").put({
    id: ruleId,
    eventId: null,
    taskId: null,
    habitId,
    followUpId: null,
    offsetMinutes: null,
    absoluteTime: 1_792_563_400_000,
    severity: "normal",
    quietHoursOverride: false,
  });
  await legacy.table("notificationOccurrences").put({
    idempotencyKey: "v14-habit-occurrence",
    ownerId: habitId,
    ruleId,
    occurrenceKey: "habit:2026-10-22:09:00:UTC",
    fireAtUTC: 1_792_573_200_000,
    internalStatus: "pending",
    read: false,
    seenMissed: false,
    nativeAttempt: "not_started",
    nativeApiStatus: null,
    osDisplay: "unobserved",
    attempt: 1,
    quietHoursOverride: false,
    sourceKind: "habit",
    title: "Keep habit",
  });
  await legacy.table("goals").put({
    id: goalId,
    profileId,
    title: "Keep goal",
    description: "Existing goal",
    status: "active",
    startDate: "2026-10-01",
    targetDate: "2026-10-31",
    progress: { mode: "manual", target: 3, current: 1 },
    ...stamp,
  });
  await legacy.table("milestones").put({
    id: milestoneId,
    goalId,
    title: "Keep milestone",
    targetDate: "2026-10-25",
    completed: false,
    sortIndex: 0,
    ...stamp,
  });
  await legacy.table("goalRelations").put({
    id: "67676767-6767-4767-8767-676767676767",
    goalId,
    targetKind: "habit",
    targetId: habitId,
    ...stamp,
  });
  await legacy.table("weeklyReviews").put({
    id: "68686868-6868-4868-8868-686868686868",
    goalId,
    profileId,
    periodStart: "2026-10-19",
    periodEnd: "2026-10-25",
    progressSummary: 33,
    accomplishments: "Kept",
    blockers: "None",
    notes: "Existing review",
    nextActions: "Continue",
    ...stamp,
  });
  await legacy.table("reviewSchedules").put({
    id: scheduleId,
    profileId,
    noteId,
    state: "active",
    dueDate: "2026-10-22",
    lastReviewedDate: null,
    intervalDays: 1,
    repetitions: 0,
    ease: 2.5,
    ...stamp,
  });
  await legacy.table("reviewHistory").put({
    id: "69696969-6969-4969-8969-696969696969",
    scheduleId,
    profileId,
    noteId,
    reviewedDate: "2026-10-21",
    outcome: "good",
    intervalDays: 1,
    ...stamp,
  });
  await legacy.table("people").put({
    id: personId,
    profileId,
    displayName: "Keep person",
    organization: null,
    role: null,
    email: null,
    phone: null,
    tags: ["migration"],
    relationshipNotes: "Existing relationship",
    status: "active",
    ...stamp,
  });
  await legacy.table("followUps").put({
    id: followUpId,
    profileId,
    personId,
    title: "Keep follow-up",
    details: "Existing follow-up",
    dueDate: "2026-10-22",
    dueTime: "10:00",
    timeZone: "UTC",
    priority: "normal",
    contactMethod: "email",
    reminderEnabled: false,
    status: "open",
    completedAt: null,
    snoozedUntilUTC: null,
    ...stamp,
  });
  await legacy.table("interactions").put({
    id: "70707070-7070-4070-8070-707070707070",
    profileId,
    personId,
    followUpId,
    kind: "note",
    body: "Existing interaction",
    occurredAt: "2026-10-21T00:00:00.000Z",
    createdAt: stamp.createdAt,
  });
  await legacy.table("focusDeferrals").put({
    id: "71717171-7171-4171-8171-717171717171",
    profileId,
    taskId,
    deferredUntilDate: "2026-10-23",
    snoozedUntilUTC: null,
    ...stamp,
  });
  await legacy.table("inboxItems").put({
    id: inboxId,
    profileId,
    source: "manual",
    content: "Keep",
    suggestion: { kind: "note", confidence: "low", reason: "ambiguous" },
    selectedKind: "note",
    draft: { kind: "note", title: "Keep", content: "Keep", tags: [] },
    status: "pending",
    destination: null,
    operation: null,
    rejectedAt: null,
    acceptedAt: null,
    undoneAt: null,
    ...stamp,
  });
  await legacy.table("weatherLocations").put({
    id: "72727272-7272-4272-8272-727272727272",
    profileId,
    label: "Kept city",
    country: "Test",
    source: "manual",
    latitude: 35.7,
    longitude: 51.4,
    ...stamp,
  });
  await legacy.table("commutePlans").put({
    id: "73737373-7373-4373-8373-737373737373",
    profileId,
    eventId,
    occurrenceKey: "gregorian:2026-10-22:09:00:00:UTC",
    destinationLabel: "Kept destination",
    travelMinutes: 30,
    preparationMinutes: 15,
    ...stamp,
  });
  legacy.close();
  await db.open();
  expect(db.verno).toBe(15);
  expect(await db.profiles.get(profileId)).toMatchObject({
    title: "Kept v14",
    revision: 4,
  });
  expect(await db.widgets.get(widgetId)).toMatchObject({
    widgetType: "weather",
  });
  expect(await db.weatherProfiles.get(weatherId)).toMatchObject({
    networkConsent: "revoked",
  });
  const preserved = [
    ["notes", noteId],
    ["tasks", taskId],
    ["events", eventId],
    ["habits", habitId],
    ["goals", goalId],
    ["milestones", milestoneId],
    ["reviewSchedules", scheduleId],
    ["people", personId],
    ["followUps", followUpId],
    ["inboxItems", inboxId],
    ["weatherLocations", "72727272-7272-4272-8272-727272727272"],
    ["commutePlans", "73737373-7373-4373-8373-737373737373"],
  ] as const;
  for (const [table, id] of preserved)
    expect(await db.table(table).get(id)).toMatchObject({ id, revision: 4 });
  expect(await db.reminderRules.get(ruleId)).toMatchObject({
    id: ruleId,
    habitId,
  });
  expect(
    await db.notificationOccurrences.get("v14-habit-occurrence"),
  ).toMatchObject({
    idempotencyKey: "v14-habit-occurrence",
    sourceKind: "habit",
  });
  expect((await db.inboxItems.toArray())[0]?.content).toBe("Keep");
  expect(
    db.financeBillPayments.schema.indexes.some(
      (index) =>
        index.unique &&
        JSON.stringify(index.keyPath) ===
          JSON.stringify(["billId", "occurrenceDate"]),
    ),
  ).toBe(true);
  const finance = createFinance(financeDb);
  const account = await finance.createAccount(profileId, {
    name: "Post-upgrade account",
    type: "cash",
    currency: "USD",
    openingBalanceMinor: 0,
  });
  db.close();
  await db.open();
  expect(await db.financeAccounts.get(account.id)).toMatchObject({
    id: account.id,
    profileId,
    openingBalanceMinor: 0,
  });
  db.close();
});
