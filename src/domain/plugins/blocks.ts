import { z } from "zod";
import { PluginFlowError } from "./errors";
import type { PluginBlock, PluginManifest } from "./manifest";
import { parseUntrustedJson } from "./manifest";
import { pluginDataSchemaVersion, utf8Size, jsonInstanceBytes } from "./quotas";

const stateSchema = z
  .object({
    schemaVersion: z.literal(pluginDataSchemaVersion),
    blocks: z.record(z.unknown()),
  })
  .strict();

export interface CountdownRemaining {
  totalSeconds: number;
  done: boolean;
}

export interface CalculatorResult {
  kind: "value" | "divide-by-zero" | "non-finite";
  value?: number;
}

export function emptyInstance(manifest: PluginManifest) {
  const blocks: Record<string, unknown> = {};
  for (const block of manifest.blocks) blocks[block.id] = initialBlock(block);
  return checkedInstance(manifest, {
    schemaVersion: pluginDataSchemaVersion,
    blocks,
  });
}

export function initialBlock(block: PluginBlock) {
  if (block.kind === "counter") return { value: block.initial };
  if (block.kind === "checklist")
    return { checked: block.items.map(() => false) };
  if (block.kind === "progress") return { current: block.current };
  if (block.kind === "calculator")
    return { left: block.left, right: block.right };
  return {};
}

export function parseInstance(manifest: PluginManifest, input: unknown) {
  walkInstance(input);
  return checkedInstance(manifest, input);
}

function walkInstance(input: unknown) {
  parseUntrustedJson(JSON.stringify(input ?? null));
}

export function checkedInstance(manifest: PluginManifest, input: unknown) {
  if (utf8Size(input) > jsonInstanceBytes)
    throw new PluginFlowError("quota-json");
  const parsed = stateSchema.safeParse(input);
  if (!parsed.success) throw new PluginFlowError("schema");
  const ids = new Set(manifest.blocks.map((block) => block.id));
  for (const key of Object.keys(parsed.data.blocks)) {
    if (!ids.has(key)) throw new PluginFlowError("schema");
  }
  const blocks: Record<string, unknown> = {};
  for (const block of manifest.blocks) {
    blocks[block.id] = checkedBlock(
      block,
      parsed.data.blocks[block.id] ?? initialBlock(block),
    );
  }
  const data = { schemaVersion: pluginDataSchemaVersion, blocks };
  if (utf8Size(data) > jsonInstanceBytes)
    throw new PluginFlowError("quota-json");
  return data;
}

function readBlock<T>(schema: z.ZodType<T>, input: unknown) {
  const parsed = schema.safeParse(input);
  if (!parsed.success) throw new PluginFlowError("schema");
  return parsed.data;
}

function checkedBlock(block: PluginBlock, input: unknown) {
  if (block.kind === "counter") {
    const value = readBlock(
      z.object({ value: z.number().int() }).strict(),
      input,
    );
    return {
      value: Math.min(block.maximum, Math.max(block.minimum, value.value)),
    };
  }
  if (block.kind === "checklist") {
    const value = readBlock(
      z
        .object({
          checked: z.array(z.boolean()).max(block.items.length),
        })
        .strict(),
      input,
    );
    return {
      checked: block.items.map((_, index) => value.checked[index] === true),
    };
  }
  if (block.kind === "progress") {
    const value = readBlock(
      z.object({ current: z.number().finite() }).strict(),
      input,
    );
    return { current: Math.min(block.goal, Math.max(0, value.current)) };
  }
  if (block.kind === "calculator") {
    return readBlock(
      z
        .object({ left: z.number().finite(), right: z.number().finite() })
        .strict(),
      input,
    );
  }
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new PluginFlowError("schema");
  if (Object.keys(input).length > 0) throw new PluginFlowError("schema");
  return {};
}

export function calculate(
  left: number,
  right: number,
  operation: "add" | "subtract" | "multiply" | "divide",
): CalculatorResult {
  if (operation === "divide" && right === 0) return { kind: "divide-by-zero" };
  const value =
    operation === "add"
      ? left + right
      : operation === "subtract"
        ? left - right
        : operation === "multiply"
          ? left * right
          : left / right;
  if (!Number.isFinite(value)) return { kind: "non-finite" };
  return { kind: "value", value };
}

export function countdownRemaining(
  targetIso: string,
  now: Date,
): CountdownRemaining {
  const target = Date.parse(targetIso);
  if (!Number.isFinite(target)) throw new PluginFlowError("schema");
  const totalSeconds = Math.floor((target - now.getTime()) / 1000);
  return { totalSeconds, done: totalSeconds <= 0 };
}

export function defaultsDocument(input: unknown, manifest: PluginManifest) {
  if (input === undefined) return emptyInstance(manifest);
  return parseInstance(manifest, input);
}
