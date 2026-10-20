export const pluginErrorCodes = [
  "prototype",
  "schema",
  "capability",
  "host-version",
  "duplicate-id",
  "unsafe-url",
  "quota-json",
  "quota-package-images",
  "quota-instances",
  "quota-packages",
  "quota-global-images",
  "zip-input",
  "zip-uncompressed",
  "zip-entries",
  "zip-manifest",
  "zip-path",
  "zip-symlink",
  "zip-duplicate",
  "zip-encrypted",
  "zip-method",
  "zip-overlap",
  "zip-nested",
  "zip-ratio",
  "zip-structure",
  "image",
  "script",
  "wasm",
  "unknown-asset",
  "version",
  "quarantine",
  "disabled",
  "foreign-store",
  "not-found",
] as const;

export type PluginErrorCode = (typeof pluginErrorCodes)[number];

const text: Record<PluginErrorCode, { en: string; fa: string }> = {
  prototype: {
    en: "The package was rejected because it contains a forbidden object key.",
    fa: "بسته رد شد چون یک کلید ممنوع در شیء دارد.",
  },
  schema: {
    en: "The package does not match the ZDPS v1 schema.",
    fa: "بسته با طرح ZDPS نسخه ۱ سازگار نیست.",
  },
  capability: {
    en: "The package requests a capability Venus does not allow.",
    fa: "بسته قابلیتی را می‌خواهد که Venus اجازه نمی‌دهد.",
  },
  "host-version": {
    en: "This package requires a newer Venus host than this one.",
    fa: "این بسته میزبان Venus جدیدتری از این نسخه می‌خواهد.",
  },
  "duplicate-id": {
    en: "The package contains a duplicate identifier.",
    fa: "بسته یک شناسه تکراری دارد.",
  },
  "unsafe-url": {
    en: "A link uses a URL Venus will not open.",
    fa: "یک پیوند نشانی‌ای دارد که Venus باز نمی‌کند.",
  },
  "quota-json": {
    en: "Plugin data exceeds 64 KiB of UTF-8 JSON for one instance. Nothing was changed.",
    fa: "داده افزونه از ۶۴ کیبی‌بایت JSON به رمز UTF-۸ برای یک نمونه بیشتر است. چیزی تغییر نکرد.",
  },
  "quota-package-images": {
    en: "Raster images in this package exceed 1 MiB. Nothing was changed.",
    fa: "تصویرهای پیکسلی این بسته از ۱ مبی‌بایت بیشتر است. چیزی تغییر نکرد.",
  },
  "quota-instances": {
    en: "This profile already has 20 plugin instances. Nothing was changed.",
    fa: "این نمایه از قبل ۲۰ نمونه افزونه دارد. چیزی تغییر نکرد.",
  },
  "quota-packages": {
    en: "Venus already has 50 installed plugin packages. Nothing was changed.",
    fa: "Venus از قبل ۵۰ بسته افزونه نصب‌شده دارد. چیزی تغییر نکرد.",
  },
  "quota-global-images": {
    en: "Stored plugin images would exceed 5 MiB. Existing data was not deleted.",
    fa: "تصویرهای ذخیره‌شده افزونه‌ها از ۵ مبی‌بایت بیشتر می‌شد. داده موجود حذف نشد.",
  },
  "zip-input": {
    en: "The archive is larger than 2 MiB compressed. Nothing was changed.",
    fa: "بایگانی فشرده از ۲ مبی‌بایت بزرگ‌تر است. چیزی تغییر نکرد.",
  },
  "zip-uncompressed": {
    en: "The archive expands beyond 2 MiB. Nothing was changed.",
    fa: "بایگانی بیش از ۲ مبی‌بایت باز می‌شود. چیزی تغییر نکرد.",
  },
  "zip-entries": {
    en: "The archive has more than 32 entries. Nothing was changed.",
    fa: "بایگانی بیش از ۳۲ ورودی دارد. چیزی تغییر نکرد.",
  },
  "zip-manifest": {
    en: "manifest.json is larger than 64 KiB. Nothing was changed.",
    fa: "manifest.json از ۶۴ کیبی‌بایت بزرگ‌تر است. چیزی تغییر نکرد.",
  },
  "zip-path": {
    en: "The archive contains a path Venus does not allow. Nothing was changed.",
    fa: "بایگانی مسیری دارد که Venus اجازه نمی‌دهد. چیزی تغییر نکرد.",
  },
  "zip-symlink": {
    en: "The archive contains a symbolic link. Nothing was changed.",
    fa: "بایگانی پیوند نمادین دارد. چیزی تغییر نکرد.",
  },
  "zip-duplicate": {
    en: "The archive repeats a file name. Nothing was changed.",
    fa: "بایگانی یک نام فایل را تکرار کرده است. چیزی تغییر نکرد.",
  },
  "zip-encrypted": {
    en: "Encrypted archives are rejected. Nothing was changed.",
    fa: "بایگانی رمزگذاری‌شده رد می‌شود. چیزی تغییر نکرد.",
  },
  "zip-method": {
    en: "The archive uses a compression method Venus does not support. Nothing was changed.",
    fa: "بایگانی از روش فشرده‌سازی پشتیبانی‌نشده استفاده می‌کند. چیزی تغییر نکرد.",
  },
  "zip-overlap": {
    en: "The archive headers disagree or overlap. Nothing was changed.",
    fa: "سربرگ‌های بایگانی ناسازگار یا هم‌پوشان هستند. چیزی تغییر نکرد.",
  },
  "zip-nested": {
    en: "Nested archives are rejected. Nothing was changed.",
    fa: "بایگانی تودرتو رد می‌شود. چیزی تغییر نکرد.",
  },
  "zip-ratio": {
    en: "The archive compression ratio is too high. Nothing was changed.",
    fa: "نسبت فشرده‌سازی بایگانی بیش از حد است. چیزی تغییر نکرد.",
  },
  "zip-structure": {
    en: "The archive structure is not valid. Nothing was changed.",
    fa: "ساختار بایگانی معتبر نیست. چیزی تغییر نکرد.",
  },
  image: {
    en: "An image is not a valid PNG, JPEG, or WebP file. Nothing was changed.",
    fa: "یک تصویر فایل PNG، JPEG یا WebP معتبر نیست. چیزی تغییر نکرد.",
  },
  script: {
    en: "Plugin JavaScript is not allowed. Nothing was changed.",
    fa: "جاوااسکریپت افزونه مجاز نیست. چیزی تغییر نکرد.",
  },
  wasm: {
    en: "Plugin WebAssembly is not allowed. Nothing was changed.",
    fa: "وب‌اسمبلی افزونه مجاز نیست. چیزی تغییر نکرد.",
  },
  "unknown-asset": {
    en: "The package contains an unknown file or manifest field. Nothing was changed.",
    fa: "بسته فایل یا فیلد ناشناخته دارد. چیزی تغییر نکرد.",
  },
  version: {
    en: "The package version is not a newer compatible update. Nothing was changed.",
    fa: "نسخه بسته یک به‌روزرسانی جدیدتر و سازگار نیست. چیزی تغییر نکرد.",
  },
  quarantine: {
    en: "This plugin is quarantined. Its data is still stored.",
    fa: "این افزونه قرنطینه شده است. داده‌اش هنوز ذخیره است.",
  },
  disabled: {
    en: "This plugin is disabled. Its data is still stored.",
    fa: "این افزونه غیرفعال است. داده‌اش هنوز ذخیره است.",
  },
  "foreign-store": {
    en: "A plugin cannot read notes, events, bookmarks, or another plugin.",
    fa: "یک افزونه نمی‌تواند یادداشت، رویداد، نشانک یا افزونه دیگری را بخواند.",
  },
  "not-found": {
    en: "That plugin is not installed.",
    fa: "آن افزونه نصب نشده است.",
  },
};

export class PluginFlowError extends Error {
  readonly messages: { en: string; fa: string };

  constructor(readonly code: PluginErrorCode) {
    const messages = text[code];
    super(messages.en);
    this.name = "PluginFlowError";
    this.messages = messages;
  }
}
