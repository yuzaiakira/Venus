import { z } from "zod";

export const workspaceSchemaVersion = 3;
export const logicalColumns = 4;
export const maxAssetBytes = 5 * 1024 * 1024;
export const maxAssetPixels = 8_000_000;

export const locales = ["en", "fa"] as const;
export const numeralSystems = ["latin", "persian"] as const;
export const calendarDisplays = ["gregorian", "jalali", "both"] as const;
export const themeModes = ["light", "dark", "system"] as const;
export const presets = [
  "minimal",
  "productivity",
  "personal",
  "custom",
] as const;
export const widgetTypes = [
  "clock",
  "search",
  "bookmarks",
  "upcoming",
  "today",
  "timer",
  "notes",
  "briefing",
] as const;
export const sharedKinds = ["note", "task", "event", "bookmark"] as const;
export const allowedMime = ["image/png", "image/jpeg", "image/webp"] as const;

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/);
export const WallpaperSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("scene"),
      sceneId: z.enum(["orbit", "nebula", "dawn"]),
    })
    .strict(),
  z
    .object({
      kind: z.literal("gradient"),
      from: hex,
      to: hex,
      angle: z.number().int().min(0).max(360),
    })
    .strict(),
  z.object({ kind: z.literal("upload"), assetId: z.string().uuid() }).strict(),
]);
export const ModuleFlagsSchema = z
  .object({
    clock: z.boolean(),
    search: z.boolean(),
    bookmarks: z.boolean(),
    upcoming: z.boolean(),
    today: z.boolean(),
    timer: z.boolean(),
    notes: z.boolean(),
    briefing: z.boolean(),
  })
  .strict();
export const BootstrapSchema = z
  .object({
    schemaVersion: z.literal(workspaceSchemaVersion),
    locale: z.enum(locales),
    numeralSystem: z.enum(numeralSystems),
    timeZone: z.string().min(1),
    weekStart: z.union([z.literal(0), z.literal(1), z.literal(6)]),
    calendarDisplay: z.enum(calendarDisplays),
    hourFormat: z.union([z.literal(12), z.literal(24)]),
    themeMode: z.enum(themeModes),
    selectedProfileId: z.string().uuid().or(z.literal("")),
    onboardingComplete: z.boolean(),
    modules: ModuleFlagsSchema,
    motion: z.enum(["system", "off", "on"]),
    density: z.enum(["comfortable", "compact"]),
    fontScale: z.number().min(0.85).max(1.4),
    blurPx: z.number().int().min(0).max(16),
    glassAlpha: z.number().min(0.65).max(0.95),
    accent: hex,
    wallpaper: WallpaperSchema,
    searchProviderId: z.enum(["duckduckgo", "google", "custom"]),
    customSearchTemplate: z.string().max(300),
  })
  .strict();

export type Wallpaper = z.infer<typeof WallpaperSchema>;
export type Bootstrap = z.infer<typeof BootstrapSchema>;
export type WidgetType = (typeof widgetTypes)[number];
export type Preset = (typeof presets)[number];
export type SharedKind = (typeof sharedKinds)[number];
export type ThemeMode = (typeof themeModes)[number];

export interface ProfileRecord {
  id: string;
  title: string;
  revision: number;
  createdAt: string;
  updatedAt: string;
  preset: Preset;
  themeMode: ThemeMode | null;
  wallpaper: Wallpaper | null;
  blurPx: number | null;
  glassAlpha: number | null;
  accent: string | null;
}
export interface WidgetRecord {
  id: string;
  profileId: string;
  widgetType: WidgetType | "fault" | "plugin";
  revision: number;
  createdAt: string;
  updatedAt: string;
  x: number;
  y: number;
  w: number;
  h: number;
  visible: boolean;
  settings: Record<string, string | number | boolean>;
}
export interface SharedItem {
  id: string;
  kind: SharedKind;
  title: string;
  revision: number;
}
export interface AssetRecord {
  id: string;
  mime: (typeof allowedMime)[number];
  byteLength: number;
  width: number;
  height: number;
  sha256: string;
  bytes: Uint8Array;
}
export interface Placement {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export const defaultModules: Bootstrap["modules"] = {
  clock: true,
  search: true,
  bookmarks: true,
  upcoming: true,
  today: true,
  timer: true,
  notes: true,
  briefing: true,
};

export function defaultBootstrap(timeZone = "UTC"): Bootstrap {
  return BootstrapSchema.parse({
    schemaVersion: workspaceSchemaVersion,
    locale: "en",
    numeralSystem: "latin",
    timeZone,
    weekStart: 1,
    calendarDisplay: "gregorian",
    hourFormat: 24,
    themeMode: "system",
    selectedProfileId: "",
    onboardingComplete: false,
    modules: defaultModules,
    motion: "system",
    density: "comfortable",
    fontScale: 1,
    blurPx: 8,
    glassAlpha: 0.86,
    accent: "#5B4DB8",
    wallpaper: { kind: "scene", sceneId: "orbit" },
    searchProviderId: "duckduckgo",
    customSearchTemplate: "",
  });
}

/** Approved Venus Concept v2 palette (hex solids for contrast/glass math). */
export const themeTokens = {
  light: {
    canvas: "#ECECF7",
    surface: "#FDFCFF",
    text: "#22233C",
    muted: "#63657D",
    border: "#C4B8E0",
    focus: "#7752CB",
    error: "#8E1B2C",
    success: "#0F5C45",
  },
  dark: {
    canvas: "#080B17",
    surface: "#161B32",
    text: "#F3F1FF",
    muted: "#9E9EB5",
    border: "#4A4A6E",
    focus: "#CBBAFF",
    error: "#FFB4C0",
    success: "#9BE7CF",
  },
} as const;

export function channelLinear(value: number) {
  const s = value / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}
export function luminance(hexColor: string) {
  const parsed = /^#([0-9a-fA-F]{6})$/.exec(hexColor);
  if (!parsed?.[1]) throw new Error("invalidInput");
  const n = Number.parseInt(parsed[1], 16);
  const r = channelLinear((n >> 16) & 255);
  const g = channelLinear((n >> 8) & 255);
  const b = channelLinear(n & 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
export function contrastRatio(a: string, b: string) {
  const left = luminance(a);
  const right = luminance(b);
  const light = Math.max(left, right);
  const dark = Math.min(left, right);
  return (light + 0.05) / (dark + 0.05);
}
export function mixHex(base: string, tint: string, baseWeight: number) {
  const read = (hexColor: string) => {
    const n = Number.parseInt(hexColor.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255] as const;
  };
  const [br, bg, bb] = read(base);
  const [tr, tg, tb] = read(tint);
  const mix = (c: number, d: number) =>
    Math.round(c * baseWeight + d * (1 - baseWeight));
  const part = (n: number) => n.toString(16).padStart(2, "0");
  return `#${part(mix(br, tr))}${part(mix(bg, tg))}${part(mix(bb, tb))}`;
}
export function glassSolid(theme: keyof typeof themeTokens, alpha: number) {
  let weight = Math.min(0.95, Math.max(0.65, alpha));
  const tokens = themeTokens[theme];
  let solid = mixHex(tokens.surface, tokens.canvas, weight);
  while (contrastRatio(tokens.text, solid) < 4.5 && weight < 0.95) {
    weight = Math.min(0.95, weight + 0.05);
    solid = mixHex(tokens.surface, tokens.canvas, weight);
  }
  return solid;
}

const sizes = [
  { w: 1, h: 1 },
  { w: 2, h: 1 },
  { w: 2, h: 2 },
] as const;
export function isAllowedSize(w: number, h: number) {
  return sizes.some((size) => size.w === w && size.h === h);
}
export function overlaps(a: Placement, b: Placement) {
  return (
    a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
  );
}
export function placementsFit(items: Placement[], columns: number) {
  for (const item of items) {
    if (item.x < 0 || item.y < 0 || item.x + item.w > columns) return false;
    const stored = isAllowedSize(item.w, item.h);
    const reflowed =
      item.w >= 1 && item.w <= columns && (item.h === 1 || item.h === 2);
    if (!stored && !reflowed) return false;
  }
  for (let i = 0; i < items.length; i += 1) {
    for (let j = i + 1; j < items.length; j += 1) {
      const left = items[i];
      const right = items[j];
      if (left && right && overlaps(left, right)) return false;
    }
  }
  return true;
}
export function columnsFor(width: number) {
  if (width < 720) return 1;
  if (width < 1100) return 2;
  return logicalColumns;
}
export function reflow(items: Placement[], columns: number): Placement[] {
  const sorted = [...items].sort((a, b) => a.y - b.y || a.x - b.x);
  const occupied = new Set<string>();
  const placed: Placement[] = [];
  for (const item of sorted) {
    const w = Math.min(item.w, columns);
    const h = item.h;
    let spot: { x: number; y: number } | null = null;
    for (let y = 0; y < 80 && !spot; y += 1) {
      for (let x = 0; x <= columns - w; x += 1) {
        let free = true;
        for (let yy = y; yy < y + h && free; yy += 1) {
          for (let xx = x; xx < x + w; xx += 1) {
            if (occupied.has(`${xx}:${yy}`)) free = false;
          }
        }
        if (free) spot = { x, y };
      }
    }
    if (!spot) throw new Error("invalidInput");
    for (let yy = spot.y; yy < spot.y + h; yy += 1) {
      for (let xx = spot.x; xx < spot.x + w; xx += 1)
        occupied.add(`${xx}:${yy}`);
    }
    placed.push({ id: item.id, x: spot.x, y: spot.y, w, h });
  }
  return placed;
}
export function storedFit(items: Placement[]) {
  for (const item of items) {
    if (!isAllowedSize(item.w, item.h)) return false;
    if (item.x < 0 || item.y < 0 || item.x + item.w > logicalColumns)
      return false;
  }
  for (let i = 0; i < items.length; i += 1) {
    for (let j = i + 1; j < items.length; j += 1) {
      const left = items[i];
      const right = items[j];
      if (left && right && overlaps(left, right)) return false;
    }
  }
  return true;
}
export function movePlacement(
  items: Placement[],
  id: string,
  dx: number,
  dy: number,
) {
  const next = items.map((item) =>
    item.id === id
      ? { ...item, x: item.x + dx, y: Math.max(0, item.y + dy) }
      : item,
  );
  if (!storedFit(next)) throw new Error("invalidInput");
  return next;
}
/**
 * Move a widget by dropping it on another widget.  Reflowing the ordered
 * layout makes this work for widgets of different sizes without ever storing
 * overlapping cells.
 */
export function reorderPlacement(
  items: Placement[],
  id: string,
  beforeId: string,
) {
  if (id === beforeId) return items;
  const moving = items.find((item) => item.id === id);
  const target = items.findIndex((item) => item.id === beforeId);
  if (!moving || target < 0) throw new Error("invalidInput");
  const ordered = [...items]
    .sort((a, b) => a.y - b.y || a.x - b.x)
    .filter((item) => item.id !== id);
  const index = ordered.findIndex((item) => item.id === beforeId);
  ordered.splice(index, 0, moving);
  return reflow(ordered, logicalColumns);
}
export function resizePlacement(
  items: Placement[],
  id: string,
  w: number,
  h: number,
) {
  if (!isAllowedSize(w, h)) throw new Error("invalidInput");
  const next = items.map((item) => (item.id === id ? { ...item, w, h } : item));
  if (!storedFit(next)) throw new Error("invalidInput");
  return next;
}

const presetLayouts: Record<
  Exclude<Preset, "custom">,
  { type: WidgetType; x: number; y: number; w: number; h: number }[]
> = {
  minimal: [
    { type: "clock", x: 0, y: 0, w: 2, h: 2 },
    { type: "search", x: 2, y: 0, w: 2, h: 1 },
  ],
  productivity: [
    { type: "clock", x: 0, y: 0, w: 2, h: 1 },
    { type: "search", x: 2, y: 0, w: 2, h: 1 },
    { type: "today", x: 0, y: 1, w: 2, h: 2 },
    { type: "upcoming", x: 2, y: 1, w: 2, h: 1 },
    { type: "notes", x: 2, y: 2, w: 1, h: 1 },
    { type: "timer", x: 3, y: 2, w: 1, h: 1 },
    { type: "bookmarks", x: 0, y: 3, w: 2, h: 1 },
  ],
  personal: [
    { type: "clock", x: 0, y: 0, w: 2, h: 2 },
    { type: "bookmarks", x: 2, y: 0, w: 2, h: 1 },
    { type: "notes", x: 2, y: 1, w: 2, h: 1 },
    { type: "search", x: 0, y: 2, w: 2, h: 1 },
    { type: "upcoming", x: 2, y: 2, w: 2, h: 1 },
  ],
};
export function layoutFor(preset: Exclude<Preset, "custom">) {
  return presetLayouts[preset].map((item) => ({ ...item }));
}

export function numberingLocale(
  locale: Bootstrap["locale"],
  numeralSystem: Bootstrap["numeralSystem"],
) {
  const language = locale === "fa" ? "fa" : "en";
  const digits = numeralSystem === "persian" ? "arabext" : "latn";
  return `${language}-u-nu-${digits}`;
}
export function directionFor(locale: Bootstrap["locale"]) {
  return locale === "fa" ? "rtl" : "ltr";
}
export function formatClock(date: Date, prefs: Bootstrap) {
  const locale = numberingLocale(prefs.locale, prefs.numeralSystem);
  const calendars =
    prefs.calendarDisplay === "both"
      ? (["persian", "gregory"] as const)
      : ([prefs.calendarDisplay === "jalali" ? "persian" : "gregory"] as const);
  const dates = calendars.map((calendar) =>
    new Intl.DateTimeFormat(locale, {
      calendar,
      timeZone: prefs.timeZone,
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    }).format(date),
  );
  const time = new Intl.DateTimeFormat(locale, {
    timeZone: prefs.timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: prefs.hourFormat === 12 ? "h12" : "h23",
  }).format(date);
  return { dates, time };
}
export function weekLabels(prefs: Bootstrap) {
  const sunday = new Date(Date.UTC(2024, 0, 7));
  const locale = prefs.locale === "fa" ? "fa" : "en";
  const labels: string[] = [];
  for (let index = 0; index < 7; index += 1) {
    const day = new Date(
      sunday.getTime() + ((prefs.weekStart + index) % 7) * 86400000,
    );
    labels.push(
      new Intl.DateTimeFormat(locale, {
        weekday: "short",
        timeZone: "UTC",
      }).format(day),
    );
  }
  return labels;
}
export function formatNumber(
  value: number,
  prefs: Pick<Bootstrap, "locale" | "numeralSystem">,
) {
  return new Intl.NumberFormat(
    numberingLocale(prefs.locale, prefs.numeralSystem),
  ).format(value);
}

export const searchProviders = {
  duckduckgo: "https://duckduckgo.com/?q={query}",
  google: "https://www.google.com/search?q={query}",
} as const;
export function searchTemplate(prefs: Bootstrap) {
  if (prefs.searchProviderId === "custom") return prefs.customSearchTemplate;
  return searchProviders[prefs.searchProviderId];
}
export function webSearchUrl(template: string, query: string) {
  const trimmed = query.trim();
  if (!trimmed || trimmed.length > 300) throw new Error("invalidInput");
  const first = template.indexOf("{query}");
  if (first < 0 || template.indexOf("{query}", first + 1) >= 0)
    throw new Error("invalidInput");
  const url = new URL(template.replace("{query}", encodeURIComponent(trimmed)));
  if (url.protocol !== "https:") throw new Error("invalidInput");
  return url.href;
}

export function validateAsset(input: {
  mime: string;
  byteLength: number;
  width: number;
  height: number;
}) {
  if (!allowedMime.includes(input.mime as (typeof allowedMime)[number]))
    throw new Error("invalidInput");
  if (input.byteLength <= 0 || input.byteLength > maxAssetBytes)
    throw new Error("invalidInput");
  if (
    input.width < 1 ||
    input.height < 1 ||
    input.width * input.height > maxAssetPixels
  )
    throw new Error("invalidInput");
  return input as {
    mime: (typeof allowedMime)[number];
    byteLength: number;
    width: number;
    height: number;
  };
}
export function validateAccent(
  accent: string,
  theme: keyof typeof themeTokens,
) {
  const parsed = hex.safeParse(accent);
  if (!parsed.success) throw new Error("invalidInput");
  if (contrastRatio(parsed.data, themeTokens[theme].canvas) < 3)
    throw new Error("invalidInput");
  return parsed.data;
}
export function resolveTheme(
  mode: ThemeMode,
  prefersDark: boolean,
): keyof typeof themeTokens {
  if (mode === "system") return prefersDark ? "dark" : "light";
  return mode;
}
export function paletteShortcutAllowed(tagName: string, editable: boolean) {
  if (editable) return false;
  return !["INPUT", "TEXTAREA", "SELECT"].includes(tagName);
}

export class WorkspaceError extends Error {
  constructor(
    readonly code: "conflict" | "invalidInput" | "notFound" | "storageError",
  ) {
    super(code);
  }
}
