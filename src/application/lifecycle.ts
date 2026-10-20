import type { ProbeSessionPort } from "../domain/foundation";
import type { createProbeScheduler } from "./scheduler";

export function createProbeLifecycle(
  scheduler: ReturnType<typeof createProbeScheduler>,
  session: ProbeSessionPort,
  now: () => number = Date.now,
) {
  // storage.session survives worker suspension, but not browser restart.
  // All events wait for this decision so an alarm cannot overtake recovery.
  const ready = (async () => {
    const active = await session.active();
    await scheduler.restore(now(), active ? "wake" : "startup");
    await session.begin();
  })();
  return {
    ready,
    async restore() {
      await ready;
      await scheduler.restore(now(), "wake");
    },
    async fire(id: string) {
      await ready;
      await scheduler.fire(id);
    },
  };
}
