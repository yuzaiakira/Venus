import { z } from "zod";
import type { WeatherProvider } from "../application/weather";
import {
  providerForecastSchema,
  providerLocationSchema,
} from "../domain/weather";

const forecastOrigin = "https://customer-api.open-meteo.com";
const geocodingOrigin = "https://geocoding-api.open-meteo.com";
const geoResponse = z
  .object({
    results: z
      .array(
        z
          .object({
            name: z.string(),
            country: z.string().optional(),
            latitude: z.number(),
            longitude: z.number(),
          })
          .strict(),
      )
      .optional(),
  })
  .strict();
const forecastResponse = z
  .object({
    timezone: z.string(),
    utc_offset_seconds: z.number().int().optional(),
    current: z
      .object({
        time: z.string(),
        temperature_2m: z.number(),
        wind_speed_10m: z.number(),
        weather_code: z.number().int(),
      })
      .strict(),
    daily: z
      .object({
        time: z.array(z.string()),
        temperature_2m_max: z.array(z.number()),
        temperature_2m_min: z.array(z.number()),
        precipitation_probability_max: z.array(z.number()).optional(),
        precipitation_sum: z.array(z.number()).optional(),
        wind_speed_10m_max: z.array(z.number()),
        weather_code: z.array(z.number().int()),
      })
      .strict(),
  })
  .strict();

async function request(url: URL) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      credentials: "omit",
      referrerPolicy: "no-referrer",
    });
    if (!response.ok) throw new Error("weatherUnavailable");
    return await response.json();
  } catch {
    throw new Error("weatherUnavailable");
  } finally {
    clearTimeout(timeout);
  }
}
export const openMeteoCommercialProvider: WeatherProvider = {
  async search(query, apiKey) {
    const url = new URL("/v1/search", geocodingOrigin);
    url.search = new URLSearchParams({
      name: query,
      count: "5",
      language: "en",
      format: "json",
      apikey: apiKey,
    }).toString();
    const body = geoResponse.parse(await request(url));
    return (body.results ?? []).map((row) =>
      providerLocationSchema.parse({
        label: row.name,
        country: row.country ?? null,
        latitude: row.latitude,
        longitude: row.longitude,
      }),
    );
  },
  async forecast(location, timeZone, apiKey) {
    const url = new URL("/v1/forecast", forecastOrigin);
    url.search = new URLSearchParams({
      latitude: String(location.latitude),
      longitude: String(location.longitude),
      current: "temperature_2m,wind_speed_10m,weather_code",
      daily:
        "temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum,wind_speed_10m_max,weather_code",
      timezone: timeZone,
      forecast_days: "4",
      apikey: apiKey,
    }).toString();
    const body = forecastResponse.parse(await request(url));
    const days = body.daily.time.map((date, index) => ({
      date,
      temperatureMaxC: body.daily.temperature_2m_max[index]!,
      temperatureMinC: body.daily.temperature_2m_min[index]!,
      precipitationProbability:
        body.daily.precipitation_probability_max?.[index] ?? null,
      precipitationMm: body.daily.precipitation_sum?.[index] ?? null,
      windSpeedKph: body.daily.wind_speed_10m_max[index]!,
      weatherCode: body.daily.weather_code[index]!,
    }));
    return providerForecastSchema.parse({
      timezone: body.timezone,
      current: {
        temperatureC: body.current.temperature_2m,
        windSpeedKph: body.current.wind_speed_10m,
        weatherCode: body.current.weather_code,
        // Open-Meteo returns a wall-clock time for the requested timezone.
        // Convert it explicitly instead of letting the browser's own timezone
        // change the stored observation instant.
        observedAt:
          Date.parse(`${body.current.time}Z`) -
          (body.utc_offset_seconds ?? 0) * 1_000,
      },
      days,
    });
  },
};
export const weatherHostOrigins = [
  `${forecastOrigin}/*`,
  `${geocodingOrigin}/*`,
] as const;
