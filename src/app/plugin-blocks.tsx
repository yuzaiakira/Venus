import { useEffect, useState } from "react";
import {
  calculate,
  countdownRemaining,
  type CalculatorResult,
} from "../domain/plugins/blocks";
import type { PluginBlock, PluginManifest } from "../domain/plugins/manifest";
import type { PluginAssetRecord } from "../domain/plugins/records";
import { translate, type MessageKey } from "../locales/messages";

export function PluginBlocks(props: {
  manifest: PluginManifest;
  data: { blocks: Record<string, unknown> };
  assets: PluginAssetRecord[];
  locale: "en" | "fa";
  now: Date;
  disabled: boolean;
  crash?: boolean;
  onChange: (blockId: string, value: unknown) => void;
  onOpen: (url: string) => void;
}) {
  if (import.meta.env.VITE_VENUS_PLUGIN_FAULT === "1" && props.crash === true) {
    throw new Error("plugin fault");
  }
  const t = (key: MessageKey) => translate(props.locale, key);
  return (
    <div>
      {props.manifest.blocks.map((block) => (
        <section key={block.id}>
          <h3>
            <bdi>{block.title[props.locale]}</bdi>
          </h3>
          <BlockBody
            block={block}
            value={props.data.blocks[block.id]}
            asset={
              block.kind === "text-image" && block.assetPath
                ? (props.assets.find((item) => item.path === block.assetPath) ??
                  null)
                : null
            }
            locale={props.locale}
            now={props.now}
            disabled={props.disabled}
            label={t}
            onChange={(value) => props.onChange(block.id, value)}
            onOpen={props.onOpen}
          />
        </section>
      ))}
    </div>
  );
}

function BlockBody(props: {
  block: PluginBlock;
  value: unknown;
  asset: PluginAssetRecord | null;
  locale: "en" | "fa";
  now: Date;
  disabled: boolean;
  label: (key: MessageKey) => string;
  onChange: (value: unknown) => void;
  onOpen: (url: string) => void;
}) {
  const block = props.block;
  if (block.kind === "text-image") {
    return (
      <div>
        {props.asset ? (
          <Raster asset={props.asset} alt={block.title[props.locale]} />
        ) : null}
        <p>
          <bdi>{block.text[props.locale]}</bdi>
        </p>
      </div>
    );
  }
  if (block.kind === "countdown") {
    const remaining = countdownRemaining(block.targetIso, props.now);
    return (
      <p>
        {remaining.done
          ? props.label("plugin.countdownDone")
          : formatRemaining(remaining.totalSeconds)}
      </p>
    );
  }
  if (block.kind === "counter") {
    const value = record(props.value).value;
    const current = typeof value === "number" ? value : block.initial;
    return (
      <p>
        <bdi>{current}</bdi>
        <button
          className="btn"
          type="button"
          disabled={props.disabled || current - block.step < block.minimum}
          onClick={() => props.onChange({ value: current - block.step })}
        >
          −
        </button>
        <button
          className="btn"
          type="button"
          disabled={props.disabled || current + block.step > block.maximum}
          onClick={() => props.onChange({ value: current + block.step })}
        >
          +
        </button>
      </p>
    );
  }
  if (block.kind === "checklist") {
    const checked = Array.isArray(record(props.value).checked)
      ? (record(props.value).checked as boolean[])
      : [];
    return (
      <ul>
        {block.items.map((item, index) => (
          <li key={`${block.id}:${index}`}>
            <label>
              <input
                type="checkbox"
                checked={checked[index] === true}
                disabled={props.disabled}
                onChange={() => {
                  const next = block.items.map(
                    (_, itemIndex) => checked[itemIndex] === true,
                  );
                  next[index] = !next[index];
                  props.onChange({ checked: next });
                }}
              />
              <bdi>{item[props.locale]}</bdi>
            </label>
          </li>
        ))}
      </ul>
    );
  }
  if (block.kind === "quick-links") {
    return (
      <ul>
        {block.links.map((link) => (
          <li key={link.url}>
            <button
              className="btn"
              type="button"
              disabled={props.disabled}
              onClick={() => props.onOpen(link.url)}
            >
              <bdi>{link.label[props.locale]}</bdi>
            </button>
          </li>
        ))}
      </ul>
    );
  }
  if (block.kind === "calculator") {
    const left = numberOr(record(props.value).left, block.left);
    const right = numberOr(record(props.value).right, block.right);
    const result = calculate(left, right, block.operation);
    return (
      <div>
        <label>
          {props.label("plugin.left")}
          <input
            className="field"
            type="number"
            value={left}
            disabled={props.disabled}
            onChange={(event) =>
              props.onChange({
                left: Number(event.target.value),
                right,
              })
            }
          />
        </label>
        <label>
          {props.label("plugin.right")}
          <input
            className="field"
            type="number"
            value={right}
            disabled={props.disabled}
            onChange={(event) =>
              props.onChange({
                left,
                right: Number(event.target.value),
              })
            }
          />
        </label>
        <p>{resultText(result, props.label)}</p>
      </div>
    );
  }
  const current = numberOr(record(props.value).current, block.current);
  const ratio = Math.min(1, current / block.goal);
  return (
    <div>
      <label>
        {props.label("plugin.current")}
        <input
          className="field"
          type="number"
          min={0}
          max={block.goal}
          value={current}
          disabled={props.disabled}
          onChange={(event) =>
            props.onChange({ current: Number(event.target.value) })
          }
        />
      </label>
      <progress value={ratio} max={1}>
        {current} / {block.goal} {block.unit ?? ""}
      </progress>
    </div>
  );
}

function Raster(props: { asset: PluginAssetRecord; alt: string }) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    const next = URL.createObjectURL(
      new Blob([props.asset.bytes], { type: props.asset.mime }),
    );
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [props.asset]);
  if (!url) return null;
  return <img src={url} alt={props.alt} />;
}

function record(value: unknown) {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}

function numberOr(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function formatRemaining(totalSeconds: number) {
  const seconds = Math.max(0, totalSeconds);
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = seconds % 60;
  return `${days}d ${hours}h ${minutes}m ${rest}s`;
}

function resultText(
  result: CalculatorResult,
  label: (key: MessageKey) => string,
) {
  if (result.kind === "divide-by-zero") return label("plugin.divide");
  if (result.kind === "non-finite") return label("plugin.nonFinite");
  return String(result.value);
}
