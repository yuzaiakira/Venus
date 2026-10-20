import { useEffect, useState } from "react";
import type { PluginPlatform } from "../application/plugins";
import { PluginBlocks } from "./plugin-blocks";
import { emptyInstance } from "../domain/plugins/blocks";
import { PluginFlowError } from "../domain/plugins/errors";
import { sniffRaster } from "../domain/plugins/images";
import {
  requiredCapabilities,
  validateManifest,
  type PluginBlock,
  type PluginManifest,
} from "../domain/plugins/manifest";
import { maxBlocks } from "../domain/plugins/quotas";
import type {
  PluginAssetRecord,
  PluginPackageRecord,
  SafeModeState,
} from "../domain/plugins/records";
import { templateKinds, templateManifest } from "../domain/plugins/templates";
import { writePluginArchive } from "../infrastructure/zip-archive";
import { translate, type MessageKey } from "../locales/messages";

export function PluginStudio(props: {
  platform: PluginPlatform;
  profileId: string;
  locale: "en" | "fa";
  now: Date;
  onChanged: () => void;
}) {
  const t = (key: MessageKey) => translate(props.locale, key);
  const [draft, setDraft] = useState<PluginManifest>(() =>
    templateManifest("counter"),
  );
  const [assets, setAssets] = useState<PluginAssetRecord[]>([]);
  const [notice, setNotice] = useState("");
  const [packages, setPackages] = useState<PluginPackageRecord[]>([]);
  const [mode, setMode] = useState<SafeModeState>({
    enabled: false,
    exceptions: [],
  });
  const [preview, setPreview] = useState<Awaited<
    ReturnType<PluginPlatform["preview"]>
  > | null>(null);
  const [previewBytes, setPreviewBytes] = useState<Uint8Array | null>(null);

  async function reload() {
    setPackages(await props.platform.list());
    setMode(await props.platform.safeMode());
  }
  useEffect(() => {
    void reload();
  }, [props.platform]);

  async function run(action: () => Promise<void>) {
    try {
      await action();
    } catch (error) {
      setNotice(
        error instanceof PluginFlowError
          ? error.messages[props.locale]
          : t("plugin.disabled"),
      );
    }
  }

  function updateDraft(next: PluginManifest) {
    next.requestedCapabilities = requiredCapabilities(next);
    setDraft(next);
  }

  const validated = (() => {
    try {
      return validateManifest(draft);
    } catch (error) {
      return error instanceof PluginFlowError ? error : null;
    }
  })();

  return (
    <section className="glass" aria-label={t("plugin.heading")}>
      <h2>{t("plugin.heading")}</h2>
      {mode.enabled ? <p role="status">{t("plugin.safeMode")}</p> : null}
      <button
        className="btn"
        type="button"
        onClick={() =>
          void run(() => props.platform.enterSafeMode().then(reload))
        }
      >
        {t("plugin.safeModeOn")}
      </button>
      <h3>{t("plugin.builder")}</h3>
      <label>
        {t("plugin.template")}
        <select
          className="select"
          aria-label={t("plugin.template")}
          value={draft.blocks[0]?.kind ?? "counter"}
          onChange={(event) => {
            const kind = event.target.value as PluginBlock["kind"];
            updateDraft(templateManifest(kind));
            setAssets([]);
          }}
        >
          {templateKinds.map((kind) => (
            <option key={kind} value={kind}>
              {kind}
            </option>
          ))}
        </select>
      </label>
      <label>
        {t("plugin.id")}
        <input
          className="field"
          aria-label={t("plugin.id")}
          value={draft.id}
          onChange={(event) =>
            updateDraft({ ...draft, id: event.target.value })
          }
        />
      </label>
      <label>
        {t("plugin.version")}
        <input
          className="field"
          aria-label={t("plugin.version")}
          value={draft.version}
          onChange={(event) =>
            updateDraft({ ...draft, version: event.target.value })
          }
        />
      </label>
      {(
        [
          ["name", "en", "plugin.nameEn"],
          ["name", "fa", "plugin.nameFa"],
          ["description", "en", "plugin.descEn"],
          ["description", "fa", "plugin.descFa"],
        ] as const
      ).map(([field, locale, key]) => (
        <label key={key}>
          {t(key)}
          <input
            className="field"
            aria-label={t(key)}
            value={draft[field][locale]}
            onChange={(event) =>
              updateDraft({
                ...draft,
                [field]: { ...draft[field], [locale]: event.target.value },
              })
            }
          />
        </label>
      ))}
      <label>
        {t("plugin.size")}
        <select
          className="select"
          aria-label={t("plugin.size")}
          value={draft.preferredSize ?? "1x1"}
          onChange={(event) =>
            updateDraft({
              ...draft,
              preferredSize: event.target
                .value as PluginManifest["preferredSize"],
            })
          }
        >
          <option value="1x1">1x1</option>
          <option value="2x1">2x1</option>
          <option value="2x2">2x2</option>
        </select>
      </label>
      <p>{t("plugin.theme")}</p>
      <p className="muted">{t("plugin.themeInherit")}</p>
      {draft.blocks.map((block, index) => (
        <BlockFields
          key={`${block.kind}:${index}`}
          block={block}
          locale={props.locale}
          onChange={(next) => {
            const blocks = draft.blocks.slice();
            blocks[index] = next;
            updateDraft({ ...draft, blocks });
          }}
          onAsset={(asset) =>
            setAssets((current) => [
              ...current.filter((item) => item.path !== asset.path),
              asset,
            ])
          }
        />
      ))}
      <button
        className="btn"
        type="button"
        disabled={draft.blocks.length >= maxBlocks}
        onClick={() => {
          const kind = "text-image";
          const block = templateManifest(kind).blocks[0];
          if (!block) return;
          updateDraft({
            ...draft,
            blocks: [
              ...draft.blocks,
              { ...block, id: `extra${draft.blocks.length}` },
            ],
          });
        }}
      >
        {t("plugin.addBlock")}
      </button>
      <h3>{t("plugin.livePreview")}</h3>
      {validated instanceof PluginFlowError ? (
        <p className="error" role="alert">
          {validated.messages[props.locale]}
        </p>
      ) : validated ? (
        <PluginBlocks
          manifest={validated}
          data={emptyInstance(validated)}
          assets={assets}
          locale={props.locale}
          now={props.now}
          disabled
          onChange={() => undefined}
          onOpen={() => undefined}
        />
      ) : null}
      <button
        className="btn"
        type="button"
        onClick={() =>
          void run(async () => {
            const manifest = validateManifest(draft);
            const defaults = emptyInstance(manifest);
            const bytes = await writePluginArchive({
              manifest,
              assets,
              defaults,
            });
            await props.platform.install(bytes, "built");
            await props.platform.place(props.profileId, manifest.id);
            setNotice(t("plugin.saved"));
            props.onChanged();
            await reload();
          })
        }
      >
        {t("plugin.save")}
      </button>
      <h3>{t("plugin.manager")}</h3>
      <label>
        {t("plugin.import")}
        <input
          aria-label={t("plugin.import")}
          type="file"
          accept=".zplugin,.zip,application/zip"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            void run(async () => {
              const bytes = new Uint8Array(await file.arrayBuffer());
              setPreview(await props.platform.preview(bytes));
              setPreviewBytes(bytes);
            });
          }}
        />
      </label>
      {preview ? (
        <div>
          <h3>{t("plugin.preview")}</h3>
          <p>
            <bdi>{preview.manifest.name[props.locale]}</bdi>{" "}
            {preview.manifest.version}
          </p>
          <p>
            {t("plugin.capabilities")}{" "}
            {preview.manifest.requestedCapabilities.join(", ")}
          </p>
          <PluginBlocks
            manifest={preview.manifest}
            data={preview.defaults}
            assets={preview.assets}
            locale={props.locale}
            now={props.now}
            disabled
            onChange={() => undefined}
            onOpen={() => undefined}
          />
          <button
            className="btn"
            type="button"
            onClick={() =>
              void run(async () => {
                if (!previewBytes) return;
                await props.platform.install(previewBytes, "imported");
                setNotice(t("plugin.installed"));
                setPreview(null);
                setPreviewBytes(null);
                await reload();
              })
            }
          >
            {t("plugin.install")}
          </button>
        </div>
      ) : null}
      <ul>
        {packages.map((pkg) => (
          <li key={pkg.id}>
            <bdi>{pkg.manifest.name[props.locale]}</bdi> {pkg.version}{" "}
            {pkg.origin}
            <button
              className="btn"
              type="button"
              onClick={() =>
                void run(async () => {
                  const file = await props.platform.exportPackage(pkg.id);
                  download(file.filename, file.bytes);
                })
              }
            >
              {t("plugin.export")}
            </button>
            <button
              className="btn"
              type="button"
              onClick={() =>
                void run(() =>
                  props.platform.setEnabled(pkg.id, !pkg.enabled).then(reload),
                )
              }
            >
              {pkg.enabled ? t("plugin.disable") : t("plugin.enable")}
            </button>
            <button
              className="btn"
              type="button"
              onClick={() =>
                void run(() =>
                  props.platform.place(props.profileId, pkg.id).then(() => {
                    props.onChanged();
                    return reload();
                  }),
                )
              }
            >
              {t("plugin.place")}
            </button>
            <button
              className="btn"
              type="button"
              onClick={() =>
                void run(() => props.platform.reenable(pkg.id).then(reload))
              }
            >
              {t("plugin.reenable")}
            </button>
            <button
              className="btn"
              type="button"
              onClick={() =>
                void run(() =>
                  props.platform.clearQuarantine(pkg.id).then(reload),
                )
              }
            >
              {t("plugin.clearQuarantine")}
            </button>
            <button
              className="btn"
              type="button"
              onClick={() =>
                void run(() =>
                  props.platform.uninstall(pkg.id, true).then(reload),
                )
              }
            >
              {t("plugin.keepData")}
            </button>
            <button
              className="btn"
              type="button"
              onClick={() =>
                void run(() =>
                  props.platform.uninstall(pkg.id, false).then(reload),
                )
              }
            >
              {t("plugin.deleteData")}
            </button>
          </li>
        ))}
      </ul>
      {notice ? <p role="status">{notice}</p> : null}
    </section>
  );
}

function BlockFields(props: {
  block: PluginBlock;
  locale: "en" | "fa";
  onChange: (block: PluginBlock) => void;
  onAsset: (asset: PluginAssetRecord) => void;
}) {
  const block = props.block;
  return (
    <fieldset>
      <legend>{block.kind}</legend>
      <label>
        id
        <input
          className="field"
          aria-label={`${block.kind} id`}
          value={block.id}
          onChange={(event) =>
            props.onChange({ ...block, id: event.target.value })
          }
        />
      </label>
      <label>
        en
        <input
          className="field"
          aria-label={`${block.kind} en`}
          value={block.title.en}
          onChange={(event) =>
            props.onChange({
              ...block,
              title: { ...block.title, en: event.target.value },
            })
          }
        />
      </label>
      <label>
        fa
        <input
          className="field"
          aria-label={`${block.kind} fa`}
          value={block.title.fa}
          onChange={(event) =>
            props.onChange({
              ...block,
              title: { ...block.title, fa: event.target.value },
            })
          }
        />
      </label>
      {block.kind === "text-image" ? (
        <>
          <input
            className="field"
            aria-label="text en"
            value={block.text.en}
            onChange={(event) =>
              props.onChange({
                ...block,
                text: { ...block.text, en: event.target.value },
              })
            }
          />
          <input
            className="field"
            aria-label="text fa"
            value={block.text.fa}
            onChange={(event) =>
              props.onChange({
                ...block,
                text: { ...block.text, fa: event.target.value },
              })
            }
          />
          <input
            aria-label="image"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              void file.arrayBuffer().then((buffer) => {
                const bytes = new Uint8Array(buffer);
                const image = sniffRaster(bytes);
                const path = `assets/picture.${file.name.split(".").pop() ?? "png"}`;
                props.onAsset({ path, bytes, ...image });
                props.onChange({ ...block, assetPath: path });
              });
            }}
          />
        </>
      ) : null}
      {block.kind === "countdown" ? (
        <input
          className="field"
          aria-label="target"
          type="datetime-local"
          onChange={(event) => {
            const parsed = new Date(event.target.value);
            if (Number.isNaN(parsed.getTime())) return;
            props.onChange({ ...block, targetIso: parsed.toISOString() });
          }}
        />
      ) : null}
      {block.kind === "counter" ? (
        <CounterFields block={block} onChange={props.onChange} />
      ) : null}
      {block.kind === "calculator" ? (
        <label>
          operation
          <select
            className="select"
            aria-label="operation"
            value={block.operation}
            onChange={(event) =>
              props.onChange({
                ...block,
                operation: event.target
                  .value as PluginManifest["blocks"][number] extends infer B
                  ? B extends { operation: infer O }
                    ? O
                    : never
                  : never,
              })
            }
          >
            {["add", "subtract", "multiply", "divide"].map((operation) => (
              <option key={operation} value={operation}>
                {operation}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      {block.kind === "progress" ? (
        <>
          <input
            className="field"
            aria-label="goal"
            type="number"
            value={block.goal}
            onChange={(event) =>
              props.onChange({ ...block, goal: Number(event.target.value) })
            }
          />
          <input
            className="field"
            aria-label="unit"
            value={block.unit ?? ""}
            onChange={(event) =>
              props.onChange({ ...block, unit: event.target.value })
            }
          />
        </>
      ) : null}
      {block.kind === "quick-links" ? (
        <input
          className="field"
          aria-label="url"
          value={block.links[0]?.url ?? ""}
          onChange={(event) =>
            props.onChange({
              ...block,
              links: [
                {
                  label: block.links[0]?.label ?? { en: "Link", fa: "پیوند" },
                  url: event.target.value,
                },
              ],
            })
          }
        />
      ) : null}
    </fieldset>
  );
}

function CounterFields(props: {
  block: Extract<PluginBlock, { kind: "counter" }>;
  onChange: (block: PluginBlock) => void;
}) {
  return (
    <>
      {(["initial", "minimum", "maximum", "step"] as const).map((field) => (
        <label key={field}>
          {field}
          <input
            className="field"
            aria-label={field}
            type="number"
            value={props.block[field]}
            onChange={(event) =>
              props.onChange({
                ...props.block,
                [field]: Number(event.target.value),
              })
            }
          />
        </label>
      ))}
    </>
  );
}

function download(filename: string, bytes: Uint8Array) {
  const url = URL.createObjectURL(
    new Blob([bytes], { type: "application/zip" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function PluginWidget(props: {
  platform: PluginPlatform;
  pluginId: string;
  instanceId: string;
  locale: "en" | "fa";
  now: Date;
  crash?: boolean;
}) {
  const t = (key: MessageKey) => translate(props.locale, key);
  const [view, setView] = useState<
    Awaited<ReturnType<PluginPlatform["list"]>>[number] | null
  >(null);
  const [data, setData] = useState<ReturnType<typeof emptyInstance> | null>(
    null,
  );
  const [mode, setMode] = useState<SafeModeState>({
    enabled: false,
    exceptions: [],
  });
  useEffect(() => {
    void props.platform.list().then(async (rows) => {
      setView(rows.find((row) => row.id === props.pluginId) ?? null);
      setMode(await props.platform.safeMode());
      try {
        setData(
          await props.platform.readSelf(props.pluginId, props.instanceId),
        );
      } catch {
        setData(null);
      }
    });
  }, [props.platform, props.pluginId, props.instanceId]);
  if (!view) return <p>{t("plugin.disabled")}</p>;
  if (view.quarantined) return <p role="alert">{t("plugin.quarantine")}</p>;
  if (!view.enabled) return <p>{t("plugin.disabled")}</p>;
  if (props.platform.hidden(view, mode))
    return <p role="status">{t("plugin.safeHidden")}</p>;
  if (!data) return <p>{t("plugin.disabled")}</p>;
  return (
    <PluginBlocks
      manifest={view.manifest}
      data={data}
      assets={view.assets}
      locale={props.locale}
      now={props.now}
      disabled={false}
      crash={props.crash === true}
      onChange={(blockId, value) => {
        const next = {
          ...data,
          blocks: { ...data.blocks, [blockId]: value },
        };
        void props.platform
          .writeSelf(props.pluginId, props.instanceId, next)
          .then(setData);
      }}
      onOpen={(url) => {
        const parsed = new URL(url);
        const confirmed =
          parsed.protocol === "https:" ||
          window.confirm(t("plugin.httpConfirm"));
        if (!confirmed) return;
        void props.platform.openLink(props.pluginId, url, true);
      }}
    />
  );
}
