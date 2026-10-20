import { useState } from "react";
import {
  inspectCapabilities,
  changePermission,
  testBookmarks,
  readProbeResults,
  scheduleProbe,
} from "../application/probes";
import "../design/tokens.css";
export function App() {
  const [fa, setFa] = useState(false);
  const [status, setStatus] = useState("");
  const text = (en: string, persian: string) => (fa ? persian : en);
  async function run(action: () => Promise<unknown>) {
    try {
      const result = await action();
      setStatus(JSON.stringify(result ?? { ok: true }, null, 2));
    } catch {
      setStatus(
        text(
          "Operation failed. Check permission and local storage; no success is claimed.",
          "عملیات ناموفق بود. مجوز و ذخیره‌سازی محلی را بررسی کنید.",
        ),
      );
    }
  }
  return (
    <main lang={fa ? "fa" : "en"} dir={fa ? "rtl" : "ltr"}>
      <h1>Venus</h1>
      <p>{text("Local-only P00 feasibility build", "نسخه محلی آزمایشی P00")}</p>
      <button
        onClick={() => {
          setFa(!fa);
          document.documentElement.lang = fa ? "en" : "fa";
          document.documentElement.dir = fa ? "ltr" : "rtl";
        }}
      >
        English / فارسی
      </button>
      <p>
        <a href="options.html">
          {text("Settings and platform tests", "تنظیمات و آزمون‌های مرورگر")}
        </a>
      </p>
      <h2>
        {text(
          "Home is controlled by your browser",
          "صفحه خانه در کنترل مرورگر است",
        )}
      </h2>
      <p>
        {text(
          "Firefox: Settings → Home → Homepage and new windows. Review the extension control notice, retain or disable it there. Installation consent and conflicts require real browser verification.",
          "فایرفاکس: تنظیمات ← خانه ← صفحه خانه و پنجره‌های جدید. کنترل افزونه را در مرورگر بررسی و فعال یا غیرفعال کنید.",
        )}
      </p>
      <p>
        {text(
          "Chrome: Settings → Appearance → Show Home button → New Tab page. Then click Home and verify Venus opens. A custom local page address is an alternative only if accepted by your browser. This manual path requires verification; no automatic Chrome Home override is declared.",
          "کروم: تنظیمات ← ظاهر ← نمایش دکمه خانه ← صفحه تب جدید. سپس خانه را بزنید و باز شدن Venus را بررسی کنید. نشانی محلی سفارشی فقط در صورت پذیرش مرورگر گزینه دیگری است. این مسیر دستی نیاز به آزمون دارد؛ تغییر خودکار خانه اعلام نشده است.",
        )}
      </p>
      <p>
        {text(
          "These probes change browser permissions. The bookmark test creates, edits and removes one synthetic bookmark only. Use an isolated test profile.",
          "این آزمون‌ها مجوزهای مرورگر را تغییر می‌دهند. آزمون بوکمارک یک مورد ساختگی را ایجاد، ویرایش و حذف می‌کند. از نمایه آزمایشی استفاده کنید.",
        )}
      </p>
      <button onClick={() => void run(inspectCapabilities)}>
        {text("Inspect permissions and manifest", "بررسی مجوزها و مانیفست")}
      </button>
      {(["bookmarks", "notifications"] as const).map((name) => (
        <div key={name}>
          <button onClick={() => void run(() => changePermission(name, true))}>
            {text("Request", "درخواست")} {name}
          </button>
          <button onClick={() => void run(() => changePermission(name, false))}>
            {text("Revoke", "لغو")} {name}
          </button>
        </div>
      ))}
      <button
        onClick={() => {
          if (
            confirm(
              text(
                "Create, edit and delete one synthetic browser bookmark?",
                "یک بوکمارک آزمایشی ایجاد، ویرایش و حذف شود؟",
              ),
            )
          )
            void run(testBookmarks);
        }}
      >
        {text(
          "Test native bookmark read/write",
          "آزمون خواندن و نوشتن بوکمارک",
        )}
      </button>
      <button onClick={() => void run(scheduleProbe)}>
        {text("Schedule a 60-second alarm probe", "آزمون هشدار ۶۰ ثانیه‌ای")}
      </button>
      <button onClick={() => void run(readProbeResults)}>
        {text("Read durable probe results", "مشاهده نتایج ذخیره‌شده")}
      </button>
      <p>
        {text(
          "A closed browser cannot notify on time. API acceptance does not prove OS display. Missed probes are recovered after restart.",
          "مرورگر بسته اعلان به‌موقع ندارد. پذیرش API نمایش اعلان سیستم را ثابت نمی‌کند. آزمون‌های ازدست‌رفته پس از راه‌اندازی بازیابی می‌شوند.",
        )}
      </p>
      <pre role="status" aria-live="polite">
        {status}
      </pre>
    </main>
  );
}
