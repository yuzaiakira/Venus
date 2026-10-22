import { z } from "zod";
import { WorkspaceError } from "./dashboard";

const stamp = {
  id: z.string().uuid(),
  revision: z.number().int().min(1),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
};
export const weatherProviderId = "open-meteo-commercial" as const;
export const weatherConsentVersion = 1;
const coordinates = z
  .object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
  })
  .strict();
export const weatherProfileSchema = z
  .object({
    ...stamp,
    profileId: z.string().uuid(),
    provider: z.literal(weatherProviderId),
    networkConsent: z.enum(["unset", "granted", "revoked"]),
    deviceLocationConsent: z.enum(["unset", "granted", "revoked"]),
    consentVersion: z.literal(weatherConsentVersion),
    providerTermsAccepted: z.boolean(),
    apiKey: z.string().min(1).max(300).nullable(),
  })
  .strict();
export const weatherLocationSchema = z
  .object({
    ...stamp,
    profileId: z.string().uuid(),
    label: z.string().min(1).max(160),
    country: z.string().max(100).nullable(),
    source: z.enum(["manual", "device"]),
    ...coordinates.shape,
  })
  .strict();
const forecastDaySchema = z
  .object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    temperatureMaxC: z.number(),
    temperatureMinC: z.number(),
    precipitationProbability: z.number().min(0).max(100).nullable(),
    precipitationMm: z.number().min(0).nullable(),
    windSpeedKph: z.number().min(0),
    weatherCode: z.number().int(),
  })
  .strict();
export const weatherForecastSchema = z
  .object({
    ...stamp,
    profileId: z.string().uuid(),
    locationId: z.string().uuid(),
    provider: z.literal(weatherProviderId),
    fetchedAt: z.number().int().nonnegative(),
    expiresAt: z.number().int().nonnegative(),
    timezone: z.string().min(1),
    current: z
      .object({
        temperatureC: z.number(),
        windSpeedKph: z.number().min(0),
        weatherCode: z.number().int(),
        observedAt: z.number().int().nonnegative(),
      })
      .strict(),
    days: z.array(forecastDaySchema).min(1).max(7),
  })
  .strict();
export const commutePlanSchema = z
  .object({
    ...stamp,
    profileId: z.string().uuid(),
    eventId: z.string().uuid(),
    occurrenceKey: z.string().min(1),
    destinationLabel: z.string().max(160).nullable(),
    travelMinutes: z.number().int().min(0).max(720),
    preparationMinutes: z.number().int().min(0).max(240),
  })
  .strict();
export const providerLocationSchema = z
  .object({
    label: z.string().min(1).max(160),
    country: z.string().max(100).nullable(),
    ...coordinates.shape,
  })
  .strict();
export const providerForecastSchema = z
  .object({
    timezone: z.string().min(1),
    current: z
      .object({
        temperatureC: z.number(),
        windSpeedKph: z.number().min(0),
        weatherCode: z.number().int(),
        observedAt: z.number().int().nonnegative(),
      })
      .strict(),
    days: z.array(forecastDaySchema).min(1).max(7),
  })
  .strict();
export type WeatherProfileRecord = z.infer<typeof weatherProfileSchema>;
export type WeatherLocationRecord = z.infer<typeof weatherLocationSchema>;
export type WeatherForecastRecord = z.infer<typeof weatherForecastSchema>;
export type CommutePlanRecord = z.infer<typeof commutePlanSchema>;
export type ProviderLocation = z.infer<typeof providerLocationSchema>;
export type ProviderForecast = z.infer<typeof providerForecastSchema>;
export function roundedDeviceCoordinates(latitude: number, longitude: number) {
  return {
    latitude: Math.round(latitude * 100) / 100,
    longitude: Math.round(longitude * 100) / 100,
  };
}
export function leaveBy(
  startAtUTC: number,
  travelMinutes: number,
  preparationMinutes: number,
) {
  return startAtUTC - (travelMinutes + preparationMinutes) * 60_000;
}
export function requireWeatherConsent(row: WeatherProfileRecord) {
  if (
    row.networkConsent !== "granted" ||
    !row.providerTermsAccepted ||
    !row.apiKey
  )
    throw new WorkspaceError("invalidInput");
  return row;
}
