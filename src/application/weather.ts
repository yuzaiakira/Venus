import { WorkspaceError, type ProfileRecord } from "../domain/dashboard";
import {
  leaveBy,
  providerLocationSchema,
  providerForecastSchema,
  requireWeatherConsent,
  roundedDeviceCoordinates,
  weatherConsentVersion,
  weatherForecastSchema,
  weatherLocationSchema,
  weatherProfileSchema,
  commutePlanSchema,
  weatherProviderId,
  type CommutePlanRecord,
  type ProviderForecast,
  type ProviderLocation,
  type WeatherForecastRecord,
  type WeatherLocationRecord,
  type WeatherProfileRecord,
} from "../domain/weather";
import type { RowTable } from "./productivity";
import type { WorkspaceChange } from "./workspace";
import type { createCalendar } from "./calendar";
import type { EventRecord } from "../domain/time/records";

export interface WeatherProvider {
  search(query: string, apiKey: string): Promise<ProviderLocation[]>;
  forecast(
    location: ProviderLocation,
    timeZone: string,
    apiKey: string,
  ): Promise<ProviderForecast>;
}
export interface WeatherDatabase {
  profiles: RowTable<ProfileRecord>;
  weatherProfiles: RowTable<WeatherProfileRecord>;
  weatherLocations: RowTable<WeatherLocationRecord>;
  weatherForecasts: RowTable<WeatherForecastRecord>;
  commutePlans: RowTable<CommutePlanRecord>;
  transaction<T>(
    mode: "rw",
    tables: RowTable<unknown>[],
    work: () => Promise<T>,
  ): Promise<T>;
}
export type CommuteEntry = {
  plan: CommutePlanRecord;
  event: EventRecord | null;
  startAtUTC: number | null;
  leaveAtUTC: number | null;
  past: boolean;
};
export type UpcomingCommitment = {
  eventId: string;
  title: string;
  occurrenceKey: string;
  startAtUTC: number;
  timeZone: string;
};
export type WeatherWorkspace = {
  preference: WeatherProfileRecord;
  location: WeatherLocationRecord | null;
  forecast: WeatherForecastRecord | null;
  stale: boolean;
  commute: CommuteEntry[];
  upcoming: UpcomingCommitment[];
};
const cacheMs = 30 * 60_000;
const refreshThrottleMs = 10 * 60_000;
function stamp(revision = 1) {
  const now = new Date().toISOString();
  return { revision, createdAt: now, updatedAt: now };
}
function bump<T extends { revision: number; updatedAt: string }>(
  row: T,
  patch: Partial<T>,
): T {
  return {
    ...row,
    ...patch,
    revision: row.revision + 1,
    updatedAt: new Date().toISOString(),
  };
}

export function createWeather(
  database: WeatherDatabase,
  notify: (change: WorkspaceChange) => void = () => {},
  input: {
    provider: WeatherProvider;
    calendar: ReturnType<typeof createCalendar>;
    now?: () => number;
  },
) {
  const now = input.now ?? Date.now;
  const changed = (id: string, revision: number) =>
    notify({ type: "workspace", id, revision });
  async function requireProfile(profileId: string) {
    if (!(await database.profiles.get(profileId)))
      throw new WorkspaceError("notFound");
  }
  async function preference(profileId: string) {
    await requireProfile(profileId);
    const existing = (await database.weatherProfiles.toArray()).find(
      (row) => row.profileId === profileId,
    );
    if (existing) return existing;
    const row = weatherProfileSchema.parse({
      id: crypto.randomUUID(),
      profileId,
      provider: weatherProviderId,
      networkConsent: "unset",
      deviceLocationConsent: "unset",
      consentVersion: weatherConsentVersion,
      providerTermsAccepted: false,
      apiKey: null,
      ...stamp(),
    });
    await database.weatherProfiles.put(row);
    return row;
  }
  async function selectedLocation(profileId: string) {
    return (
      (await database.weatherLocations.toArray()).find(
        (row) => row.profileId === profileId,
      ) ?? null
    );
  }
  async function forecast(
    profileId: string,
    location: WeatherLocationRecord | null,
  ) {
    if (!location) return null;
    return (
      (await database.weatherForecasts.toArray()).find(
        (row) => row.profileId === profileId && row.locationId === location.id,
      ) ?? null
    );
  }
  async function commute(profileId: string) {
    const [plans, schedule] = await Promise.all([
      database.commutePlans.toArray(),
      input.calendar.list(),
    ]);
    const events = new Map(schedule.events.map((event) => [event.id, event]));
    const rows: CommuteEntry[] = [];
    for (const plan of plans.filter((row) => row.profileId === profileId)) {
      const event = events.get(plan.eventId) ?? null;
      const occurrence = event
        ? ((await input.calendar.occurrences(event.id)).find(
            (row) => row.key === plan.occurrenceKey,
          ) ?? null)
        : null;
      const startAtUTC = occurrence?.epochMs ?? null;
      const leaveAtUTC =
        startAtUTC === null
          ? null
          : leaveBy(startAtUTC, plan.travelMinutes, plan.preparationMinutes);
      rows.push({
        plan,
        event,
        startAtUTC,
        leaveAtUTC,
        past: leaveAtUTC !== null && leaveAtUTC < now(),
      });
    }
    return rows.sort(
      (a, b) => (a.leaveAtUTC ?? Infinity) - (b.leaveAtUTC ?? Infinity),
    );
  }
  async function upcoming() {
    const events = (await input.calendar.list()).events.filter(
      (event) => !event.allDay,
    );
    const rows: UpcomingCommitment[] = [];
    for (const event of events)
      for (const occurrence of await input.calendar.occurrences(event.id))
        if (
          occurrence.epochMs >= now() &&
          occurrence.epochMs <= now() + 31 * 86_400_000
        )
          rows.push({
            eventId: event.id,
            title: event.title,
            occurrenceKey: occurrence.key,
            startAtUTC: occurrence.epochMs,
            timeZone: occurrence.timeZone,
          });
    return rows.sort((a, b) => a.startAtUTC - b.startAtUTC).slice(0, 12);
  }
  async function load(profileId: string): Promise<WeatherWorkspace> {
    const pref = await preference(profileId);
    const location = await selectedLocation(profileId);
    const cached = await forecast(profileId, location);
    return {
      preference: pref,
      location,
      forecast: cached,
      stale: !cached || cached.expiresAt <= now(),
      commute: await commute(profileId),
      upcoming: await upcoming(),
    };
  }
  async function grantNetwork(
    profileId: string,
    expected: number,
    apiKey: string,
  ) {
    const row = await database.transaction(
      "rw",
      [database.profiles, database.weatherProfiles],
      async () => {
        const current = await preference(profileId);
        if (current.revision !== expected) throw new WorkspaceError("conflict");
        const next = weatherProfileSchema.parse(
          bump(current, {
            networkConsent: "granted",
            providerTermsAccepted: true,
            apiKey: apiKey.trim(),
          }),
        );
        await database.weatherProfiles.put(next);
        return next;
      },
    );
    changed(row.id, row.revision);
    return row;
  }
  async function revokeNetwork(profileId: string, expected: number) {
    const row = await database.transaction(
      "rw",
      [database.profiles, database.weatherProfiles, database.weatherForecasts],
      async () => {
        const current = await preference(profileId);
        if (current.revision !== expected) throw new WorkspaceError("conflict");
        const next = weatherProfileSchema.parse(
          bump(current, {
            networkConsent: "revoked",
            providerTermsAccepted: false,
            apiKey: null,
          }),
        );
        await database.weatherProfiles.put(next);
        for (const cached of await database.weatherForecasts.toArray())
          if (cached.profileId === profileId)
            await database.weatherForecasts.delete(cached.id);
        return next;
      },
    );
    changed(row.id, row.revision);
    return row;
  }
  async function setLocation(
    profileId: string,
    location: ProviderLocation,
    source: "manual" | "device",
    expected?: number,
  ) {
    const valid = providerLocationSchema.parse(location);
    const coordinates = roundedDeviceCoordinates(
      valid.latitude,
      valid.longitude,
    );
    const row = await database.transaction(
      "rw",
      [
        database.profiles,
        database.weatherProfiles,
        database.weatherLocations,
        database.weatherForecasts,
      ],
      async () => {
        await preference(profileId);
        const prior = await selectedLocation(profileId);
        if (prior && (expected === undefined || prior.revision !== expected))
          throw new WorkspaceError("conflict");
        const next = weatherLocationSchema.parse(
          prior
            ? bump(prior, {
                label: valid.label,
                country: valid.country,
                source,
                ...coordinates,
              })
            : {
                id: crypto.randomUUID(),
                profileId,
                label: valid.label,
                country: valid.country,
                source,
                ...coordinates,
                ...stamp(),
              },
        );
        await database.weatherLocations.put(next);
        if (
          prior &&
          (prior.latitude !== next.latitude ||
            prior.longitude !== next.longitude)
        )
          for (const cached of await database.weatherForecasts.toArray())
            if (cached.locationId === prior.id)
              await database.weatherForecasts.delete(cached.id);
        return next;
      },
    );
    changed(row.id, row.revision);
    return row;
  }
  async function useDeviceLocation(
    profileId: string,
    expected: number,
    latitude: number,
    longitude: number,
    label = "Device location",
  ) {
    const coords = roundedDeviceCoordinates(latitude, longitude);
    await database.transaction(
      "rw",
      [database.profiles, database.weatherProfiles],
      async () => {
        const current = await preference(profileId);
        if (current.revision !== expected) throw new WorkspaceError("conflict");
        await database.weatherProfiles.put(
          weatherProfileSchema.parse(
            bump(current, { deviceLocationConsent: "granted" }),
          ),
        );
      },
    );
    const prior = await selectedLocation(profileId);
    return setLocation(
      profileId,
      { label, country: null, ...coords },
      "device",
      prior?.revision,
    );
  }
  async function clearLocation(profileId: string, expected: number) {
    const row = await database.transaction(
      "rw",
      [database.weatherLocations, database.weatherForecasts],
      async () => {
        const current = await selectedLocation(profileId);
        if (!current) throw new WorkspaceError("notFound");
        if (current.revision !== expected) throw new WorkspaceError("conflict");
        await database.weatherLocations.delete(current.id);
        for (const cached of await database.weatherForecasts.toArray())
          if (cached.locationId === current.id)
            await database.weatherForecasts.delete(cached.id);
        return current;
      },
    );
    changed(row.id, row.revision + 1);
  }
  async function search(profileId: string, query: string) {
    const pref = requireWeatherConsent(await preference(profileId));
    if (!query.trim()) throw new WorkspaceError("invalidInput");
    return (await input.provider.search(query.trim(), pref.apiKey!)).map(
      (row) => providerLocationSchema.parse(row),
    );
  }
  async function refresh(profileId: string, timeZone: string) {
    const pref = requireWeatherConsent(await preference(profileId));
    const location = await selectedLocation(profileId);
    if (!location) throw new WorkspaceError("notFound");
    const existing = await forecast(profileId, location);
    if (
      existing &&
      existing.expiresAt > now() &&
      now() - existing.fetchedAt < refreshThrottleMs
    )
      return existing;
    const data = providerForecastSchema.parse(
      await input.provider.forecast(location, timeZone, pref.apiKey!),
    );
    const row = await database.transaction(
      "rw",
      [database.weatherForecasts],
      async () => {
        const current = await forecast(profileId, location);
        const next = weatherForecastSchema.parse(
          current
            ? bump(current, {
                locationId: location.id,
                provider: weatherProviderId,
                fetchedAt: now(),
                expiresAt: now() + cacheMs,
                timezone: data.timezone,
                current: data.current,
                days: data.days,
              })
            : {
                id: crypto.randomUUID(),
                profileId,
                locationId: location.id,
                provider: weatherProviderId,
                fetchedAt: now(),
                expiresAt: now() + cacheMs,
                timezone: data.timezone,
                current: data.current,
                days: data.days,
                ...stamp(),
              },
        );
        await database.weatherForecasts.put(next);
        return next;
      },
    );
    changed(row.id, row.revision);
    return row;
  }
  async function saveCommute(
    profileId: string,
    draft: {
      id?: string;
      expected?: number;
      eventId: string;
      occurrenceKey: string;
      destinationLabel: string | null;
      travelMinutes: number;
      preparationMinutes: number;
    },
  ) {
    await requireProfile(profileId);
    const event = (await input.calendar.list()).events.find(
      (item) => item.id === draft.eventId,
    );
    if (!event) throw new WorkspaceError("notFound");
    const occurrence = (await input.calendar.occurrences(event.id)).find(
      (item) => item.key === draft.occurrenceKey,
    );
    if (!occurrence) throw new WorkspaceError("invalidInput");
    const row = await database.transaction(
      "rw",
      [database.commutePlans],
      async () => {
        const old = draft.id
          ? await database.commutePlans.get(draft.id)
          : ((await database.commutePlans.toArray()).find(
              (item) =>
                item.profileId === profileId &&
                item.eventId === draft.eventId &&
                item.occurrenceKey === draft.occurrenceKey,
            ) ?? null);
        if (
          old &&
          (old.profileId !== profileId ||
            draft.expected === undefined ||
            old.revision !== draft.expected)
        )
          throw new WorkspaceError("conflict");
        const next = commutePlanSchema.parse(
          old
            ? bump(old, {
                eventId: draft.eventId,
                occurrenceKey: draft.occurrenceKey,
                destinationLabel: draft.destinationLabel?.trim() || null,
                travelMinutes: draft.travelMinutes,
                preparationMinutes: draft.preparationMinutes,
              })
            : {
                id: crypto.randomUUID(),
                profileId,
                eventId: draft.eventId,
                occurrenceKey: draft.occurrenceKey,
                destinationLabel: draft.destinationLabel?.trim() || null,
                travelMinutes: draft.travelMinutes,
                preparationMinutes: draft.preparationMinutes,
                ...stamp(),
              },
        );
        await database.commutePlans.put(next);
        return next;
      },
    );
    changed(row.id, row.revision);
    return row;
  }
  async function deleteCommute(
    profileId: string,
    id: string,
    expected: number,
  ) {
    const row = await database.transaction(
      "rw",
      [database.commutePlans],
      async () => {
        const current = await database.commutePlans.get(id);
        if (!current || current.profileId !== profileId)
          throw new WorkspaceError("notFound");
        if (current.revision !== expected) throw new WorkspaceError("conflict");
        await database.commutePlans.delete(id);
        return current;
      },
    );
    changed(row.id, row.revision + 1);
  }
  return {
    load,
    grantNetwork,
    revokeNetwork,
    setLocation,
    useDeviceLocation,
    clearLocation,
    search,
    refresh,
    saveCommute,
    deleteCommute,
  };
}
export type Weather = ReturnType<typeof createWeather>;
