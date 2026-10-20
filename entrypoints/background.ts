import { browser } from "wxt/browser";
import { db, claimProbe, recoverProbes } from "../src/infrastructure/db";
import {
  alarms,
  notifications,
  preferences,
  probeSession,
} from "../src/infrastructure/browser";
import { diagnostic } from "../src/domain/foundation";
import { sweepAlarm } from "../src/application/calendar";
import { calendar } from "../src/infrastructure/browser-workspace";
import { createProbeScheduler } from "../src/application/scheduler";
import { createProbeLifecycle } from "../src/application/lifecycle";
export default defineBackground(() => {
  const recordFailure = () =>
    preferences.set("diagnostic", diagnostic("unexpected"));
  const scheduler = createProbeScheduler(
    {
      recover: recoverProbes,
      claim: claimProbe,
      recordNative: async (id, native) => {
        await db.probes.update(id, { native });
      },
    },
    alarms,
    notifications,
  );
  const lifecycle = createProbeLifecycle(scheduler, probeSession);
  const restore = () => lifecycle.restore();
  browser.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === sweepAlarm) {
      void calendar.reconcile(false).catch(recordFailure);
      return;
    }
    void lifecycle.fire(alarm.name).catch(recordFailure);
  });
  browser.runtime.onInstalled.addListener(() => {
    void restore().catch(recordFailure);
  });
  browser.runtime.onStartup.addListener(() => {
    void lifecycle.ready.catch(recordFailure);
  });
  let notificationListenerRegistered = false;
  function registerNotificationClick() {
    if (!notificationListenerRegistered && browser.notifications?.onClicked) {
      browser.notifications.onClicked.addListener(() => {
        void browser.tabs
          .create({ url: browser.runtime.getURL("/options.html") })
          .catch(recordFailure);
      });
      notificationListenerRegistered = true;
    }
  }
  browser.permissions.onAdded.addListener(() => {
    registerNotificationClick();
    void restore().catch(recordFailure);
  });
  browser.permissions.onRemoved.addListener(() => {
    void restore().catch(recordFailure);
  });
  registerNotificationClick();
  const sessionAtStart = probeSession.active();
  void sessionAtStart
    .then(async (active) => {
      await lifecycle.ready;
      await calendar.reconcile(!active);
    })
    .catch(recordFailure);
  browser.runtime.onMessage.addListener((message) => {
    if (message === "p00.reconcile")
      return restore().then(() => ({ ok: true }));
    return undefined;
  });
  void lifecycle.ready.catch(recordFailure);
});
