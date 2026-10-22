import { describe, expect, it } from "vitest";
import {
  leaveBy,
  providerForecastSchema,
  roundedDeviceCoordinates,
  weatherProfileSchema,
} from "../../src/domain/weather";

describe("Weather & Commute domain", () => {
  it("rounds device coordinates and calculates leave-by from user-entered buffers", () => {
    expect(roundedDeviceCoordinates(35.689512, 51.389)).toEqual({
      latitude: 35.69,
      longitude: 51.39,
    });
    expect(leaveBy(Date.UTC(2026, 2, 8, 13), 30, 10)).toBe(
      Date.UTC(2026, 2, 8, 12, 20),
    );
  });
  it("requires normalized forecast data with bounded daily values", () => {
    expect(() =>
      providerForecastSchema.parse({
        timezone: "UTC",
        current: {
          temperatureC: "20",
          windSpeedKph: 2,
          weatherCode: 0,
          observedAt: 0,
        },
        days: [],
      }),
    ).toThrow();
    expect(() =>
      weatherProfileSchema.parse({
        id: "11111111-1111-4111-8111-111111111111",
        profileId: "22222222-2222-4222-8222-222222222222",
        provider: "open-meteo-commercial",
        networkConsent: "granted",
        deviceLocationConsent: "unset",
        consentVersion: 1,
        providerTermsAccepted: true,
        apiKey: null,
        revision: 1,
        createdAt: "x",
        updatedAt: "x",
      }),
    ).not.toThrow();
  });
});
