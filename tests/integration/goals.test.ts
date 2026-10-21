import { beforeEach, describe, expect, it } from "vitest";
import { createGoals } from "../../src/application/goals";
import {
  createWorkspace,
  memoryPreferences,
} from "../../src/application/workspace";
import { createProductivity } from "../../src/application/productivity";
import { db, goalsDb, productivityDb } from "../../src/infrastructure/db";

beforeEach(async () => {
  if (!db.isOpen()) await db.open();
  await Promise.all([
    db.profiles.clear(),
    db.widgets.clear(),
    db.goals.clear(),
    db.milestones.clear(),
    db.goalRelations.clear(),
    db.weeklyReviews.clear(),
    db.tasks.clear(),
    db.habits.clear(),
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
    goals: createGoals(goalsDb),
    productivity: createProductivity(productivityDb),
  };
}

describe("Goals & Progress persistence", () => {
  it("creates, edits, archives and persists goals, ordered milestones and weekly reviews", async () => {
    const { profile, goals } = await harness();
    const goal = await goals.createGoal(profile.id, {
      title: "Launch Venus",
      description: "A measurable launch",
      startDate: "2026-10-01",
      targetDate: "2026-10-31",
      progress: { mode: "manual", target: 5, current: 1 },
    });
    const edited = await goals.updateGoal(goal.id, goal.revision, {
      description: "A local measurable launch",
      progress: { mode: "manual", target: 5, current: 3 },
    });
    const first = await goals.createMilestone(edited.id, edited.revision, {
      title: "Design review",
      targetDate: "2026-10-10",
    });
    const second = await goals.createMilestone(edited.id, edited.revision, {
      title: "Release",
      targetDate: "2026-10-31",
    });
    const renamed = await goals.updateMilestone(first.id, first.revision, {
      title: "Design review complete",
      targetDate: "2026-10-11",
    });
    const completed = await goals.updateMilestone(
      renamed.id,
      renamed.revision,
      {
        completed: true,
      },
    );
    await goals.reorderMilestones(edited.id, [
      { id: second.id, revision: second.revision },
      { id: completed.id, revision: completed.revision },
    ]);
    const review = await goals.createWeeklyReview(edited.id, edited.revision, {
      periodStart: "2026-10-05",
      periodEnd: "2026-10-11",
      accomplishments: "Validated local storage",
      blockers: "None",
      notes: "Keep scope focused",
      nextActions: "Ship the review",
    });
    await goals.updateWeeklyReview(review.id, review.revision, {
      blockers: "Browser evidence pending",
    });
    await goals.archiveGoal(edited.id, edited.revision);

    const loaded = await goals.load(profile.id);
    expect(loaded.goals[0]).toMatchObject({
      id: goal.id,
      status: "archived",
      description: "A local measurable launch",
    });
    expect(loaded.goals[0]?.progressSummary).toMatchObject({
      current: 3,
      target: 5,
      percent: 60,
      remaining: 2,
    });
    expect(loaded.goals[0]?.milestones.map((item) => item.title)).toEqual([
      "Release",
      "Design review complete",
    ]);
    expect(loaded.goals[0]?.reviews[0]).toMatchObject({
      blockers: "Browser evidence pending",
    });

    const disposable = await goals.createGoal(profile.id, {
      title: "Disposable",
      description: "",
      startDate: "2026-10-01",
      targetDate: null,
      progress: { mode: "manual", target: 1, current: 0 },
    });
    await goals.deleteGoal(disposable.id, disposable.revision);
    expect(await db.goals.get(disposable.id)).toBeUndefined();

    db.close();
    await db.open();
    expect((await goals.load(profile.id)).goals[0]?.id).toBe(goal.id);
  });

  it("derives progress from linked tasks and unique habit check-ins without changing the linked records", async () => {
    const { profile, goals, productivity } = await harness();
    const open = await productivity.createTask("Open task");
    const done = await productivity.createTask("Done task");
    await productivity.saveTask(done.id, done.revision, { status: "done" });
    const habit = await productivity.createHabit("Walk", "daily");
    const checkOne = await productivity.toggleHabit(
      habit.id,
      habit.revision,
      "2026-10-05",
    );
    await productivity.toggleHabit(
      checkOne.id,
      checkOne.revision,
      "2026-10-06",
    );

    const taskGoal = await goals.createGoal(profile.id, {
      title: "Finish work",
      description: "",
      startDate: "2026-10-01",
      targetDate: null,
      progress: { mode: "linkedTasks" },
    });
    await goals.linkRecord(taskGoal.id, taskGoal.revision, "task", open.id);
    await goals.linkRecord(taskGoal.id, taskGoal.revision, "task", done.id);
    const taskGoalData = (await goals.load(profile.id)).goals.find(
      (item) => item.id === taskGoal.id,
    );
    expect(taskGoalData?.progressSummary).toMatchObject({
      current: 1,
      target: 2,
      percent: 50,
      remaining: 1,
    });
    const currentOpen = (await productivity.load()).tasks.find(
      (task) => task.id === open.id,
    )!;
    await productivity.saveTask(currentOpen.id, currentOpen.revision, {
      status: "done",
    });
    expect(
      (await goals.load(profile.id)).goals.find(
        (item) => item.id === taskGoal.id,
      )?.progressSummary.percent,
    ).toBe(100);

    const habitGoal = await goals.createGoal(profile.id, {
      title: "Move more",
      description: "",
      startDate: "2026-10-01",
      targetDate: "2026-10-07",
      progress: {
        mode: "habitCheckIns",
        target: 3,
        periodStart: "2026-10-01",
        periodEnd: "2026-10-07",
      },
    });
    const relation = await goals.linkRecord(
      habitGoal.id,
      habitGoal.revision,
      "habit",
      habit.id,
    );
    await goals.linkRecord(habitGoal.id, habitGoal.revision, "habit", habit.id);
    const habitGoalData = (await goals.load(profile.id)).goals.find(
      (item) => item.id === habitGoal.id,
    );
    expect(habitGoalData?.progressSummary).toMatchObject({
      current: 2,
      target: 3,
      percent: 67,
      remaining: 1,
    });
    expect(habitGoalData?.relations).toHaveLength(1);
    await productivity.deleteTask(
      open.id,
      (await productivity.load()).tasks.find((task) => task.id === open.id)!
        .revision,
    );
    const stale = (await goals.load(profile.id)).goals.find(
      (item) => item.id === taskGoal.id,
    );
    expect(
      stale?.relations.find((item) => item.targetId === open.id),
    ).toMatchObject({
      available: false,
    });
    await goals.unlinkRecord(relation.id, relation.revision);
    expect(
      (await goals.load(profile.id)).goals.find(
        (item) => item.id === habitGoal.id,
      )?.relations,
    ).toHaveLength(0);
  });

  it("rejects stale writes, isolates profile records, and keeps the opt-in singleton widget after reopen", async () => {
    const { workspace, profile, goals } = await harness();
    const goal = await goals.createGoal(profile.id, {
      title: "Private outcome",
      description: "",
      startDate: "2026-10-01",
      targetDate: null,
      progress: { mode: "manual", target: 1, current: 0 },
    });
    const results = await Promise.allSettled([
      goals.updateGoal(goal.id, goal.revision, { title: "First" }),
      goals.updateGoal(goal.id, goal.revision, { title: "Second" }),
    ]);
    expect(
      results.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    expect(
      results.find((result) => result.status === "rejected"),
    ).toMatchObject({
      reason: { code: "conflict" },
    });

    const secondProfile = await workspace.createProfile("personal", "Second");
    expect((await goals.load(secondProfile.id)).goals).toHaveLength(0);
    const before = await workspace.load();
    expect(
      before.widgets.some(
        (widget) =>
          widget.profileId === profile.id && widget.widgetType === "goals",
      ),
    ).toBe(false);
    const one = await workspace.addWidget(profile.id, "goals");
    const two = await workspace.addWidget(profile.id, "goals");
    expect(two.id).toBe(one.id);
    db.close();
    await db.open();
    expect(
      (await workspace.load()).widgets.filter(
        (widget) =>
          widget.profileId === profile.id && widget.widgetType === "goals",
      ),
    ).toHaveLength(1);
    await workspace.deleteProfile(profile.id);
    expect(await db.goals.get(goal.id)).toBeUndefined();
  });
});
