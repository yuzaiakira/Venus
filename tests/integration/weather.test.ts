import { beforeEach, describe, expect, it, vi } from "vitest";
import { createCalendar } from "../../src/application/calendar";
import {
  createWeather,
  type WeatherProvider,
} from "../../src/application/weather";
import {
  createWorkspace,
  memoryPreferences,
} from "../../src/application/workspace";
import { calendarDb, db, weatherDb } from "../../src/infrastructure/db";

const fixedNow = Date.UTC(2026, 2, 7, 12);
const alarms = {
  schedule: vi.fn(async () => {}),
  clear: vi.fn(async () => {}),
};
const notifications = {
  permission: vi.fn(async () => "granted" as const),
  show: vi.fn(async () => "accepted" as const),
  clear: vi.fn(async () => {}),
};
const provider = {
  search: vi.fn(async (query) => [
    {
      label: `${query} City`,
      country: "IR",
      latitude: 35.68,
      longitude: 51.41,
    },
  ]),
  forecast: vi.fn(async () => ({
    timezone: "Asia/Tehran",
    current: {
      temperatureC: 21,
      windSpeedKph: 12,
      weatherCode: 1,
      observedAt: fixedNow,
    },
    days: [
      {
        date: "2026-03-07",
        temperatureMaxC: 24,
        temperatureMinC: 11,
        precipitationProbability: 10,
        precipitationMm: 0,
        windSpeedKph: 14,
        weatherCode: 1,
      },
    ],
  })),
} satisfies WeatherProvider;
beforeEach(async () => {
  vi.clearAllMocks();
  if (!db.isOpen()) await db.open();
  await Promise.all([
    db.profiles.clear(),
    db.widgets.clear(),
    db.events.clear(),
    db.reminderRules.clear(),
    db.notificationOccurrences.clear(),
    db.weatherProfiles.clear(),
    db.weatherLocations.clear(),
    db.weatherForecasts.clear(),
    db.commutePlans.clear(),
  ]);
});
async function harness() {
  const workspace = createWorkspace(memoryPreferences());
  const profile = (await workspace.load()).profiles[0];
  if (!profile) throw new Error("profile");
  const calendar = createCalendar({
    database: calendarDb,
    alarms,
    notifications,
    now: () => fixedNow,
  });
  return {
    workspace,
    profile,
    calendar,
    weather: createWeather(weatherDb, () => {}, {
      provider,
      calendar,
      now: () => fixedNow,
    }),
  };
}

describe("Weather & Commute privacy and persistence", () => {
  it("makes zero provider calls before consent, requires explicit city selection, caches, and cleans up after revocation", async () => {
    const { profile, weather } = await harness();
    await weather.load(profile.id);
    await expect(weather.search(profile.id, "Tehran")).rejects.toMatchObject({
      code: "invalidInput",
    });
    expect(provider.search).not.toHaveBeenCalled();
    expect(provider.forecast).not.toHaveBeenCalled();
    const initial = await weather.load(profile.id);
    await weather.grantNetwork(
      profile.id,
      initial.preference.revision,
      "commercial-key",
    );
    const matches = await weather.search(profile.id, "Tehran");
    expect(provider.search).toHaveBeenCalledOnce();
    expect(matches).toHaveLength(1);
    await weather.setLocation(profile.id, matches[0]!, "manual");
    const first = await weather.refresh(profile.id, "Asia/Tehran");
    await weather.refresh(profile.id, "Asia/Tehran");
    expect(provider.forecast).toHaveBeenCalledOnce();
    expect(first.expiresAt).toBeGreaterThan(fixedNow);
    await db.weatherForecasts.update(first.id, { expiresAt: fixedNow - 1 });
    expect((await weather.load(profile.id)).stale).toBe(true);
    provider.forecast.mockResolvedValueOnce({
      timezone: "Asia/Tehran",
      current: {
        temperatureC: 26,
        windSpeedKph: 12,
        weatherCode: 1,
        observedAt: fixedNow,
      },
      days: [
        {
          date: "2026-03-07",
          temperatureMaxC: 27,
          temperatureMinC: 13,
          precipitationProbability: 10,
          precipitationMm: 0,
          windSpeedKph: 14,
          weatherCode: 1,
        },
      ],
    });
    await weather.refresh(profile.id, "Asia/Tehran");
    expect(provider.forecast).toHaveBeenCalledTimes(2);
    expect(
      (await weather.load(profile.id)).forecast?.current.temperatureC,
    ).toBe(26);
    const current = await weather.load(profile.id);
    await weather.revokeNetwork(profile.id, current.preference.revision);
    expect((await weather.load(profile.id)).forecast).toBeNull();
    await expect(
      weather.refresh(profile.id, "Asia/Tehran"),
    ).rejects.toMatchObject({ code: "invalidInput" });
    expect(provider.forecast).toHaveBeenCalledTimes(2);
  });
  it("keeps device-location consent separate from weather consent and sends no provider request", async () => {
    const { profile, weather } = await harness();
    const initial = await weather.load(profile.id);
    await weather.useDeviceLocation(
      profile.id,
      initial.preference.revision,
      35.689512,
      51.389,
    );
    const loaded = await weather.load(profile.id);
    expect(loaded.preference).toMatchObject({
      networkConsent: "unset",
      deviceLocationConsent: "granted",
    });
    expect(loaded.location).toMatchObject({
      source: "device",
      latitude: 35.69,
      longitude: 51.39,
    });
    await expect(weather.search(profile.id, "Tehran")).rejects.toMatchObject({
      code: "invalidInput",
    });
    expect(provider.search).not.toHaveBeenCalled();
    expect(provider.forecast).not.toHaveBeenCalled();
  });
  it("persists a DST-aware user-estimated commute without altering calendar events", async () => {
    const { profile, calendar, weather, workspace } = await harness();
    const event = await calendar.createEvent({
      title: "DST meeting",
      basis: "gregorian",
      allDay: false,
      localDate: { calendar: "gregorian", year: 2026, month: 3, day: 8 },
      wall: { hour: 9, minute: 0, second: 0 },
      zoneId: "America/New_York",
      offsetMinutes: [],
    });
    const occurrence = (await calendar.occurrences(event.id))[0];
    if (!occurrence) throw new Error("occurrence");
    const plan = await weather.saveCommute(profile.id, {
      eventId: event.id,
      occurrenceKey: occurrence.key,
      destinationLabel: "Office",
      travelMinutes: 30,
      preparationMinutes: 10,
    });
    const updated = await weather.saveCommute(profile.id, {
      id: plan.id,
      expected: plan.revision,
      eventId: event.id,
      occurrenceKey: occurrence.key,
      destinationLabel: "Office",
      travelMinutes: 35,
      preparationMinutes: 10,
    });
    await expect(
      weather.saveCommute(profile.id, {
        eventId: event.id,
        occurrenceKey: occurrence.key,
        destinationLabel: "Office",
        travelMinutes: 35,
        preparationMinutes: 10,
      }),
    ).rejects.toMatchObject({ code: "conflict" });
    const loaded = await weather.load(profile.id);
    expect(loaded.commute).toHaveLength(1);
    expect(loaded.commute[0]).toMatchObject({
      plan: {
        id: plan.id,
        revision: updated.revision,
        destinationLabel: "Office",
      },
      startAtUTC: Date.UTC(2026, 2, 8, 13),
      leaveAtUTC: Date.UTC(2026, 2, 8, 12, 15),
    });
    expect(
      (await calendar.list()).events.find((row) => row.id === event.id)
        ?.revision,
    ).toBe(event.revision);
    await calendar.deleteEvent(event.id, event.revision);
    expect((await weather.load(profile.id)).commute[0]).toMatchObject({
      event: null,
      leaveAtUTC: null,
    });
    const other = await workspace.createProfile("minimal", "No weather");
    expect((await weather.load(other.id)).commute).toHaveLength(0);
    db.close();
    await db.open();
    expect((await weather.load(profile.id)).commute[0]?.plan.id).toBe(plan.id);
  });
  it("uses revisions for concurrent location and commute changes", async () => {
    const { profile, weather } = await harness();
    const pref = (await weather.load(profile.id)).preference;
    await weather.grantNetwork(profile.id, pref.revision, "commercial-key");
    const location = await weather.setLocation(
      profile.id,
      { label: "Tehran", country: "IR", latitude: 35.68, longitude: 51.41 },
      "manual",
    );
    await expect(
      weather.clearLocation(profile.id, location.revision - 1),
    ).rejects.toMatchObject({ code: "conflict" });
    await expect(
      weather.setLocation(
        profile.id,
        { label: "Shiraz", country: "IR", latitude: 29.59, longitude: 52.58 },
        "manual",
      ),
    ).rejects.toMatchObject({ code: "conflict" });
    const updated = await weather.setLocation(
      profile.id,
      { label: "Shiraz", country: "IR", latitude: 29.59, longitude: 52.58 },
      "manual",
      location.revision,
    );
    expect(updated).toMatchObject({ label: "Shiraz", revision: 2 });
  });
  it("does not replace local cache when a provider response is invalid or unavailable", async () => {
    const { profile, weather } = await harness();
    const initial = await weather.load(profile.id);
    await weather.grantNetwork(profile.id, initial.preference.revision, "key");
    await weather.setLocation(
      profile.id,
      { label: "Tehran", country: "IR", latitude: 35.68, longitude: 51.41 },
      "manual",
    );
    await expect(
      weather.setLocation(
        profile.id,
        { label: "Shiraz", country: "IR", latitude: 29.59, longitude: 52.58 },
        "manual",
      ),
    ).rejects.toMatchObject({ code: "conflict" });
    provider.forecast.mockRejectedValueOnce(new Error("rate limited"));
    await expect(weather.refresh(profile.id, "Asia/Tehran")).rejects.toThrow();
    expect((await weather.load(profile.id)).forecast).toBeNull();
    provider.forecast.mockResolvedValueOnce({
      timezone: "Asia/Tehran",
      current: {
        temperatureC: 21,
        windSpeedKph: 12,
        weatherCode: 1,
        observedAt: fixedNow,
      },
      days: [],
    });
    await expect(weather.refresh(profile.id, "Asia/Tehran")).rejects.toThrow();
    expect((await weather.load(profile.id)).forecast).toBeNull();
  });
});
