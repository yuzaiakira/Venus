import { Temporal } from "temporal-polyfill";

/**
 * The only Temporal namespace Venus uses. Callers pass this object into
 * rrule-temporal. Do not use instanceof against host Temporal values.
 */
export const VenusTemporal = Temporal;

export type PlainInstant = {
  epochMs: number;
  timeZone: string;
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

export function readZoned(value: {
  epochMilliseconds: number;
  timeZoneId: string;
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}): PlainInstant {
  return {
    epochMs: value.epochMilliseconds,
    timeZone: value.timeZoneId,
    year: value.year,
    month: value.month,
    day: value.day,
    hour: value.hour,
    minute: value.minute,
    second: value.second,
  };
}
