import { describe, expect, it } from "vitest";
import {
  addLocalDays,
  followUpSchema,
  followUpState,
  personSchema,
} from "../../src/domain/people";

const stamp = {
  id: "11111111-1111-4111-8111-111111111111",
  profileId: "22222222-2222-4222-8222-222222222222",
  revision: 1,
  createdAt: "2026-03-01T00:00:00.000Z",
  updatedAt: "2026-03-01T00:00:00.000Z",
};

describe("People & Follow-ups domain", () => {
  it("validates local-only contact and reminder records", () => {
    expect(
      personSchema.parse({
        ...stamp,
        displayName: "Ari",
        organization: "Venus",
        role: "Friend",
        email: "ari@example.test",
        phone: null,
        tags: ["friends"],
        relationshipNotes: "Prefers email",
        status: "active",
      }),
    ).toMatchObject({ displayName: "Ari", profileId: stamp.profileId });
    expect(() =>
      followUpSchema.parse({
        ...stamp,
        personId: "33333333-3333-4333-8333-333333333333",
        title: "Check in",
        dueDate: "2026-03-08",
        dueTime: null,
        timeZone: "America/New_York",
        status: "open",
        priority: "normal",
        contactMethod: "message",
        reminderEnabled: true,
        snoozedUntilUTC: null,
        completedAt: null,
      }),
    ).toThrow(/local due time/i);
  });

  it("classifies calendar dates without treating DST days as 24-hour intervals", () => {
    const base = {
      status: "open" as const,
      dueDate: "2026-03-08",
      snoozedUntilUTC: null,
    };
    expect(followUpState(base, "2026-03-08")).toBe("due");
    expect(followUpState(base, "2026-03-09")).toBe("overdue");
    expect(
      followUpState({ ...base, dueDate: "2026-03-09" }, "2026-03-08"),
    ).toBe("upcoming");
    expect(
      followUpState({ ...base, snoozedUntilUTC: 2_000 }, "2026-03-08", 1_000),
    ).toBe("snoozed");
    expect(addLocalDays("2026-03-08", 1)).toBe("2026-03-09");
    expect(addLocalDays("2026-12-31", 1)).toBe("2027-01-01");
  });
});
