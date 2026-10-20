import type { PluginBlock, PluginManifest } from "./manifest";
import { requiredCapabilities } from "./manifest";

const text = (en: string, fa: string) => ({ en, fa });

export function templateManifest(
  kind: PluginBlock["kind"],
  id = `local.${kind.replace("-", "")}`,
): PluginManifest {
  const block = templateBlock(kind);
  const manifest: PluginManifest = {
    specVersion: "1.0",
    id,
    version: "1.0.0",
    minHostVersion: "1.0.0",
    type: "declarative-widget",
    name: text("Local plugin", "افزونه محلی"),
    description: text("Built on this device", "ساخته‌شده روی این دستگاه"),
    requestedCapabilities: [],
    preferredSize: "2x1",
    blocks: [block],
  };
  manifest.requestedCapabilities = requiredCapabilities(manifest);
  return manifest;
}

function templateBlock(kind: PluginBlock["kind"]): PluginBlock {
  if (kind === "text-image")
    return {
      id: "text",
      kind,
      title: text("Note", "یادداشت"),
      text: text("Hello", "سلام"),
    };
  if (kind === "countdown")
    return {
      id: "timer",
      kind,
      title: text("Countdown", "شمارش معکوس"),
      targetIso: new Date(Date.now() + 86_400_000).toISOString(),
    };
  if (kind === "counter")
    return {
      id: "count",
      kind,
      title: text("Counter", "شمارنده"),
      initial: 0,
      minimum: 0,
      maximum: 100,
      step: 1,
    };
  if (kind === "checklist")
    return {
      id: "list",
      kind,
      title: text("Checklist", "چک‌لیست"),
      items: [text("First", "اول")],
    };
  if (kind === "quick-links")
    return {
      id: "links",
      kind,
      title: text("Links", "پیوندها"),
      links: [
        {
          label: text("Example", "نمونه"),
          url: "https://example.com/",
        },
      ],
    };
  if (kind === "calculator")
    return {
      id: "math",
      kind,
      title: text("Calculator", "ماشین‌حساب"),
      left: 1,
      right: 1,
      operation: "add",
    };
  return {
    id: "goal",
    kind: "progress",
    title: text("Progress", "پیشرفت"),
    current: 0,
    goal: 10,
    unit: "",
  };
}

export const templateKinds: PluginBlock["kind"][] = [
  "text-image",
  "countdown",
  "counter",
  "checklist",
  "quick-links",
  "calculator",
  "progress",
];
