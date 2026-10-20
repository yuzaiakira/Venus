import type { AlarmPort, NotificationPort, Probe } from "../domain/foundation";
export interface ProbeRepository {
  recover(now: number, markMissed: boolean): Promise<Probe[]>;
  claim(id: string): Promise<boolean>;
  recordNative(id: string, state: Probe["native"]): Promise<void>;
}
export function createProbeScheduler(
  repository: ProbeRepository,
  alarms: AlarmPort,
  notifications: NotificationPort,
) {
  return {
    async restore(now: number, reason: "startup" | "wake" = "startup") {
      // Only a new browser session consumes overdue probes as missed. A worker
      // waking for an alarm must leave the pending claim available to onAlarm.
      for (const probe of await repository.recover(now, reason === "startup")) {
        if (probe.state === "pending")
          await alarms.schedule(probe.id, probe.dueAt);
      }
    },
    async fire(id: string) {
      if (!(await repository.claim(id))) return;
      let state: Probe["native"];
      try {
        state = await notifications.show(id);
      } catch {
        state = "failed";
      }
      await repository.recordNative(id, state);
    },
  };
}
