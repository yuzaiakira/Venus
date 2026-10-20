import { z } from "zod";
import { PluginFlowError } from "./errors";
import { maxBlocks, zdpsHostVersion } from "./quotas";

const forbiddenKeys = new Set(["__proto__", "constructor", "prototype"]);
const capabilities = [
  "clock.read",
  "selfStorage.readWrite",
  "safeNavigation.open",
] as const;
const localized = z
  .object({
    en: z.string().min(1).max(120),
    fa: z.string().min(1).max(120),
  })
  .strict();
const blockId = z
  .string()
  .regex(/^[a-z][a-z0-9-]*$/)
  .max(64);
const finite = z.number().finite();

export const pluginManifestSchema = z
  .object({
    specVersion: z.literal("1.0"),
    id: z
      .string()
      .regex(/^[a-z][a-z0-9]*(\.[a-z][a-z0-9-]*){1,5}$/)
      .max(128),
    version: z
      .string()
      .regex(/^[0-9]+\.[0-9]+\.[0-9]+$/)
      .max(32),
    minHostVersion: z.string().regex(/^[0-9]+\.[0-9]+\.[0-9]+$/),
    type: z.literal("declarative-widget"),
    name: localized,
    description: localized,
    requestedCapabilities: z
      .array(z.enum(capabilities))
      .max(3)
      .refine((items) => new Set(items).size === items.length),
    blocks: z
      .array(
        z.discriminatedUnion("kind", [
          z
            .object({
              id: blockId,
              kind: z.literal("text-image"),
              title: localized,
              text: localized,
              assetPath: z
                .string()
                .regex(/^assets\/[a-zA-Z0-9_-]+\.(png|jpg|jpeg|webp)$/)
                .max(128)
                .optional(),
            })
            .strict(),
          z
            .object({
              id: blockId,
              kind: z.literal("countdown"),
              title: localized,
              targetIso: z.string().datetime({ offset: true }),
            })
            .strict(),
          z
            .object({
              id: blockId,
              kind: z.literal("counter"),
              title: localized,
              initial: z.number().int(),
              minimum: z.number().int(),
              maximum: z.number().int(),
              step: z.number().int().min(1).max(1000),
            })
            .strict(),
          z
            .object({
              id: blockId,
              kind: z.literal("checklist"),
              title: localized,
              items: z.array(localized).max(50),
            })
            .strict(),
          z
            .object({
              id: blockId,
              kind: z.literal("quick-links"),
              title: localized,
              links: z
                .array(
                  z
                    .object({
                      label: localized,
                      url: z.string().max(2048),
                    })
                    .strict(),
                )
                .max(25),
            })
            .strict(),
          z
            .object({
              id: blockId,
              kind: z.literal("calculator"),
              title: localized,
              left: finite,
              right: finite,
              operation: z.enum(["add", "subtract", "multiply", "divide"]),
            })
            .strict(),
          z
            .object({
              id: blockId,
              kind: z.literal("progress"),
              title: localized,
              current: z.number().finite().min(0),
              goal: z.number().finite().gt(0),
              unit: z.string().max(20).optional(),
            })
            .strict(),
        ]),
      )
      .min(1)
      .max(maxBlocks),
    preferredSize: z.enum(["1x1", "2x1", "2x2"]).optional(),
  })
  .strict();

export type PluginManifest = z.infer<typeof pluginManifestSchema>;
export type PluginBlock = PluginManifest["blocks"][number];
export type PluginCapability = (typeof capabilities)[number];

export function parseUntrustedJson(text: string): unknown {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new PluginFlowError("schema");
  }
  walk(value, 0);
  return value;
}

function walk(value: unknown, depth: number) {
  if (depth > 12) throw new PluginFlowError("schema");
  if (typeof value === "string") {
    for (let index = 0; index < value.length; index += 1) {
      const code = value.charCodeAt(index);
      if (
        (code >= 0 && code <= 8) ||
        code === 11 ||
        code === 12 ||
        (code >= 14 && code <= 31)
      )
        throw new PluginFlowError("schema");
    }
    return;
  }
  if (!value || typeof value !== "object") return;
  if (Array.isArray(value)) {
    if (value.length > 200) throw new PluginFlowError("schema");
    for (const item of value) walk(item, depth + 1);
    return;
  }
  for (const key of Object.keys(value)) {
    if (forbiddenKeys.has(key)) throw new PluginFlowError("prototype");
    walk((value as Record<string, unknown>)[key], depth + 1);
  }
}

export function validateManifest(input: unknown): PluginManifest {
  const parsed = pluginManifestSchema.safeParse(input);
  if (!parsed.success) throw new PluginFlowError("schema");
  const manifest = parsed.data;
  if (compareSemver(manifest.minHostVersion, zdpsHostVersion) > 0)
    throw new PluginFlowError("host-version");
  const ids = new Set<string>();
  for (const block of manifest.blocks) {
    if (ids.has(block.id)) throw new PluginFlowError("duplicate-id");
    ids.add(block.id);
    if (block.kind === "counter") {
      if (
        block.minimum > block.initial ||
        block.initial > block.maximum ||
        block.minimum > block.maximum
      )
        throw new PluginFlowError("schema");
    }
    if (block.kind === "quick-links") {
      for (const link of block.links) assertSafeUrl(link.url);
    }
  }
  const requested = new Set(manifest.requestedCapabilities);
  for (const capability of requiredCapabilities(manifest)) {
    if (!requested.has(capability)) throw new PluginFlowError("capability");
  }
  return manifest;
}

export function requiredCapabilities(
  manifest: PluginManifest,
): PluginCapability[] {
  const needed = new Set<PluginCapability>();
  for (const block of manifest.blocks) {
    if (block.kind === "countdown") needed.add("clock.read");
    if (
      block.kind === "counter" ||
      block.kind === "checklist" ||
      block.kind === "progress" ||
      block.kind === "calculator"
    )
      needed.add("selfStorage.readWrite");
    if (block.kind === "quick-links") needed.add("safeNavigation.open");
  }
  return [...needed];
}

export function assertSafeUrl(value: string) {
  if (!/^https?:\/\//.test(value)) throw new PluginFlowError("unsafe-url");
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new PluginFlowError("unsafe-url");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:")
    throw new PluginFlowError("unsafe-url");
  if (url.username || url.password) throw new PluginFlowError("unsafe-url");
  if (!url.hostname) throw new PluginFlowError("unsafe-url");
  return url;
}

export function compareSemver(left: string, right: string) {
  const a = left.split(".").map(Number);
  const b = right.split(".").map(Number);
  for (let index = 0; index < 3; index += 1) {
    const delta = (a[index] ?? 0) - (b[index] ?? 0);
    if (delta !== 0) return delta;
  }
  return 0;
}

export function manifestFromUnknown(text: string) {
  return validateManifest(parseUntrustedJson(text));
}
