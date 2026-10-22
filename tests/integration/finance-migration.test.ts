import Dexie from "dexie";
import { expect, it } from "vitest";

it("additively upgrades a realistic v14 workspace to v15 without losing weather, Inbox, profile or widget records", async () => {
  const { db } = await import("../../src/infrastructure/db");
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
  await legacy.table("inboxItems").put({
    id: "54545454-5454-4454-8454-545454545454",
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
  expect((await db.inboxItems.toArray())[0]?.content).toBe("Keep");
  expect(
    db.financeBillPayments.schema.indexes.some(
      (index) =>
        index.unique &&
        JSON.stringify(index.keyPath) ===
          JSON.stringify(["billId", "occurrenceDate"]),
    ),
  ).toBe(true);
  db.close();
});
