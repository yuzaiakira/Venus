import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";

// Runs only in the disposable profile created by smoke-chrome.mjs. Permission
// prompts and visible OS notifications are deliberately separate owner checks.
export async function chromeLifecycle(initialContext, launch, evidenceDir) {
  let context = initialContext;
  const evidence = {
    workerSuspension: "NOT_RUN",
    closedTabAlarm: "NOT_RUN",
    restartBeforeDue: "NOT_RUN",
    shutdownThroughDue: "NOT_RUN",
    nativeDisplay: "NOT_VERIFIED",
    permissionConsent: "NOT_VERIFIED",
  };
  const save = () =>
    writeFile(
      join(evidenceDir, "chrome-lifecycle.json"),
      JSON.stringify(evidence, null, 2),
    );
  const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  async function schedule(page) {
    await page
      .getByRole("button", {
        name: "Schedule a 60-second alarm probe",
        exact: true,
      })
      .click();
    await page.getByRole("status").filter({ hasText: '"pending"' }).waitFor();
    return JSON.parse(await page.getByRole("status").textContent());
  }
  async function read(page, id) {
    await page
      .getByRole("button", { name: "Read durable probe results", exact: true })
      .click();
    await page.getByRole("status").filter({ hasText: "[" }).waitFor();
    return JSON.parse(await page.getByRole("status").textContent()).find(
      (probe) => probe.id === id,
    );
  }
  async function open(url) {
    const page = await context.newPage();
    await page.goto(url);
    await page.getByRole("heading", { name: "Venus", exact: true }).waitFor();
    return page;
  }
  try {
    const page = context.pages().find((item) => item.url().includes("newtab"));
    assert.ok(page, "Extension New Tab page missing");
    const id = await page.evaluate(() => globalThis.chrome.runtime.id);
    const url = `chrome-extension://${id}/options.html`;
    evidence.browser = context.browser().version();
    const probe = await schedule(page);
    const worker = context
      .serviceWorkers()
      .find((item) => item.url().startsWith(`chrome-extension://${id}/`));
    assert.ok(worker, "Extension service worker not running");
    try {
      const cdp = await context.browser().newBrowserCDPSession();
      const targets = await cdp.send("Target.getTargets");
      const target = targets.targetInfos.find(
        (item) => item.type === "service_worker" && item.url === worker.url(),
      );
      assert.ok(target, "Extension worker CDP target missing");
      const closed = await cdp.send("Target.closeTarget", {
        targetId: target.targetId,
      });
      evidence.workerStopRequest = closed;
      assert.equal(
        closed.success,
        true,
        "Browser rejected extension worker stop",
      );
      const after = await cdp.send("Target.getTargets");
      assert.ok(
        !after.targetInfos.some((item) => item.targetId === target.targetId),
        "Worker target remained running after stop request",
      );
      evidence.workerSuspension =
        "PASS: original worker CDP target disappeared";
    } catch (error) {
      evidence.workerSuspension = `NOT_VERIFIED: ${String(error)}`;
      console.log(
        "Worker suspension not verified; continuing independent lifecycle checks",
      );
    }
    await save();
    for (const tab of context.pages()) {
      if (
        tab.url().startsWith("chrome-extension://") ||
        tab.url().startsWith("chrome://newtab")
      )
        await tab.close();
    }
    console.log(
      "Chrome lifecycle: extension tabs closed; waiting for 60-second alarm",
    );
    await pause(Math.max(0, probe.dueAt + 3000 - Date.now()));
    let inspection = await open(url);
    assert.deepEqual(await read(inspection, probe.id), {
      ...probe,
      state: "due",
      native: "blocked",
    });
    evidence.closedTabAlarm =
      "PASS: durable due/blocked result after extension tab closure";
    await save();

    const restartProbe = await schedule(inspection);
    await context.close();
    context = await launch();
    inspection = await open(url);
    assert.equal(
      (await read(inspection, restartProbe.id)).state,
      "pending",
      "Restart-before-due test did not retain pending state",
    );
    const alarmExists = await inspection.evaluate(
      async (probeId) =>
        (await globalThis.chrome.alarms.getAll()).some(
          (alarm) => alarm.name === probeId,
        ),
      restartProbe.id,
    );
    assert.equal(
      alarmExists,
      true,
      "Pending alarm not reconstructed after restart",
    );
    evidence.restartBeforeDue =
      "PASS: same profile DB pending and real alarm present";
    await save();

    await context.close();
    console.log(
      "Chrome lifecycle: browser closed through due time; waiting for missed recovery",
    );
    await pause(Math.max(0, restartProbe.dueAt + 3000 - Date.now()));
    context = await launch();
    inspection = await open(url);
    assert.deepEqual(await read(inspection, restartProbe.id), {
      ...restartProbe,
      state: "missed",
      native: "not_attempted",
    });
    evidence.shutdownThroughDue =
      "PASS: same profile missed/not_attempted after shutdown";
    await save();
    console.log(
      "Chrome lifecycle assertions passed; no OS display or consent pass claimed",
    );
    if (!evidence.workerSuspension.startsWith("PASS")) process.exitCode = 1;
  } catch (error) {
    evidence.error = String(error);
    await save();
    throw error;
  } finally {
    await context.close();
  }
}
