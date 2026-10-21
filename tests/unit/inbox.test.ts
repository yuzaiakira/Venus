import { describe, expect, it } from "vitest";
import {
  classifyInbox,
  draftForInbox,
  parsedInboxDate,
} from "../../src/domain/inbox";

describe("local AI Inbox classifier", () => {
  const now = Date.UTC(2026, 2, 8, 4, 30);
  it("classifies explicit English and Persian actions as tasks with an explanation", () => {
    expect(
      classifyInbox("Remember to call the dentist", "America/New_York", now)
        .suggestion,
    ).toEqual({ kind: "task", confidence: "high", reason: "action" });
    expect(
      classifyInbox("باید برای خرید تماس بگیرم", "Asia/Tehran", now).suggestion,
    ).toEqual({ kind: "task", confidence: "high", reason: "action" });
  });
  it("extracts explicit dates and wall times without inventing dates", () => {
    expect(
      classifyInbox("Planning on 2026-03-09 09:15", "America/New_York", now),
    ).toMatchObject({
      suggestion: { kind: "event", confidence: "high", reason: "dateTime" },
      draft: { date: "2026-03-09", time: "09:15", allDay: false },
    });
    expect(parsedInboxDate("فردا", "America/New_York", now)).toEqual({
      date: "2026-03-08",
      time: null,
    });
    expect(
      draftForInbox("event", "An idea with no date", "UTC", now),
    ).toMatchObject({ date: null, time: null, allDay: true });
  });
  it("keeps ambiguous text as a low-confidence local note", () => {
    expect(
      classifyInbox("Blue sky and a question", "UTC", now).suggestion,
    ).toEqual({ kind: "note", confidence: "low", reason: "ambiguous" });
  });
});
