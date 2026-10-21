import { beforeEach, describe, expect, it } from "vitest";
import { createProductivity } from "../../src/application/productivity";
import { createReviews } from "../../src/application/reviews";
import {
  createWorkspace,
  memoryPreferences,
} from "../../src/application/workspace";
import { emptyDocument } from "../../src/domain/productivity";
import { db, productivityDb, reviewsDb } from "../../src/infrastructure/db";

beforeEach(async () => {
  if (!db.isOpen()) await db.open();
  await Promise.all([
    db.profiles.clear(),
    db.widgets.clear(),
    db.notes.clear(),
    db.noteDrafts.clear(),
    db.reviewSchedules.clear(),
    db.reviewHistory.clear(),
  ]);
});

async function harness() {
  const workspace = createWorkspace(memoryPreferences());
  const snapshot = await workspace.load();
  const profile = snapshot.profiles[0];
  if (!profile) throw new Error("profile missing");
  return {
    workspace,
    profile,
    reviews: createReviews(reviewsDb),
    productivity: createProductivity(productivityDb),
  };
}

describe("Knowledge Review persistence", () => {
  it("enrolls notes, transitions each rating once, postpones, and persists after reopen", async () => {
    const { profile, reviews, productivity } = await harness();
    const note = await productivity.createNote({
      title: "Local knowledge",
      body: emptyDocument("Remember this"),
      folderId: null,
    });
    const schedule = await reviews.enroll(profile.id, note.id, "2026-03-08");
    expect((await reviews.load(profile.id, "2026-03-08")).due).toHaveLength(1);

    const attempts = await Promise.allSettled([
      reviews.submitRating(
        schedule.id,
        schedule.revision,
        "good",
        "2026-03-08",
      ),
      reviews.submitRating(
        schedule.id,
        schedule.revision,
        "good",
        "2026-03-08",
      ),
    ]);
    expect(
      attempts.filter((attempt) => attempt.status === "fulfilled"),
    ).toHaveLength(1);
    expect(
      attempts.filter((attempt) => attempt.status === "rejected"),
    ).toHaveLength(1);
    const good = attempts.find(
      (
        attempt,
      ): attempt is PromiseFulfilledResult<
        Awaited<ReturnType<typeof reviews.submitRating>>
      > => attempt.status === "fulfilled",
    )?.value;
    if (!good) throw new Error("review rating did not persist");
    expect(good).toMatchObject({
      dueDate: "2026-03-10",
      intervalDays: 2,
      repetitions: 1,
    });
    expect(
      (await reviews.load(profile.id, "2026-03-09")).upcoming,
    ).toHaveLength(1);
    const postponed = await reviews.postpone(
      good.id,
      good.revision,
      "2026-03-10",
    );
    expect(postponed).toMatchObject({
      dueDate: "2026-03-11",
      repetitions: 1,
      lastReviewedDate: "2026-03-08",
    });
    const loaded = await reviews.load(profile.id, "2026-03-10");
    expect(loaded.schedules[0]?.history.map((item) => item.outcome)).toEqual([
      "postpone",
      "good",
    ]);

    db.close();
    await db.open();
    const reopened = await reviews.load(profile.id, "2026-03-10");
    expect(reopened.schedules[0]).toMatchObject({
      id: schedule.id,
      dueDate: "2026-03-11",
    });
    expect(reopened.schedules[0]?.history).toHaveLength(2);
  });

  it("keeps calendar-day review states deterministic through DST and supports pause, resume and removal", async () => {
    const { profile, reviews, productivity } = await harness();
    const note = await productivity.createNote({
      title: "DST",
      body: emptyDocument("America/New_York"),
      folderId: null,
    });
    const schedule = await reviews.enroll(profile.id, note.id, "2026-03-08");
    const again = await reviews.submitRating(
      schedule.id,
      schedule.revision,
      "again",
      "2026-03-08",
    );
    expect(again.dueDate).toBe("2026-03-09");
    const paused = await reviews.pause(again.id, again.revision);
    expect((await reviews.load(profile.id, "2026-03-12")).paused[0]?.id).toBe(
      paused.id,
    );
    const resumed = await reviews.resume(
      paused.id,
      paused.revision,
      "2026-03-12",
    );
    expect(resumed.dueDate).toBe("2026-03-12");
    await reviews.remove(resumed.id, resumed.revision);
    expect(
      (await reviews.load(profile.id, "2026-03-12")).schedules,
    ).toHaveLength(0);
    expect(await db.notes.get(note.id)).toMatchObject({ title: "DST" });
  });

  it("isolates profile schedules, gracefully retains unavailable note schedules, and keeps the widget opt-in singleton", async () => {
    const { workspace, profile, reviews, productivity } = await harness();
    const note = await productivity.createNote({
      title: "Shared note",
      body: emptyDocument("content"),
      folderId: null,
    });
    const schedule = await reviews.enroll(profile.id, note.id, "2026-10-21");
    const other = await workspace.createProfile("minimal", "Other");
    expect((await reviews.load(other.id, "2026-10-21")).schedules).toHaveLength(
      0,
    );
    const one = await workspace.addWidget(profile.id, "reviews");
    const two = await workspace.addWidget(profile.id, "reviews");
    expect(one.id).toBe(two.id);
    const originalLayout = (await workspace.load()).widgets
      .filter(
        (widget) => widget.profileId === profile.id && widget.id !== one.id,
      )
      .map(({ id, x, y, w, h }) => ({ id, x, y, w, h }));
    expect(originalLayout).toHaveLength(2);
    await workspace.removeWidget(one.id);
    expect(
      (await workspace.load()).widgets
        .filter((widget) => widget.profileId === profile.id)
        .map(({ id, x, y, w, h }) => ({ id, x, y, w, h })),
    ).toEqual(originalLayout);
    expect(
      (await reviews.load(profile.id, "2026-10-21")).schedules[0]?.id,
    ).toBe(schedule.id);

    const stored = await db.notes.get(note.id);
    if (!stored) throw new Error("note missing");
    await productivity.saveNote(stored.id, stored.revision, { archived: true });
    const unavailable = await reviews.load(profile.id, "2026-10-21");
    expect(unavailable.schedules[0]).toMatchObject({
      availability: "unavailable",
    });
    expect(unavailable.due).toHaveLength(0);
    await db.notes.delete(note.id);
    expect(
      (await reviews.load(profile.id, "2026-10-21")).schedules[0],
    ).toMatchObject({ availability: "unavailable", note: null });
  });
});
