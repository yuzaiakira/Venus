import { z } from "zod";

const stamp = {
  id: z.string().uuid(),
  revision: z.number().int().min(1),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
};
export const currencySchema = z.string().regex(/^[A-Z]{3}$/);
export const moneySchema = z
  .number()
  .int()
  .safe()
  .min(0)
  .max(9_000_000_000_000_000);
export const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
export const accountSchema = z
  .object({
    ...stamp,
    profileId: z.string().uuid(),
    name: z.string().min(1).max(120),
    type: z.enum(["cash", "bank", "card", "other"]),
    currency: currencySchema,
    openingBalanceMinor: z
      .number()
      .int()
      .safe()
      .min(-9_000_000_000_000_000)
      .max(9_000_000_000_000_000),
    archived: z.boolean(),
  })
  .strict();
export const categorySchema = z
  .object({
    ...stamp,
    profileId: z.string().uuid(),
    name: z.string().min(1).max(80),
    kind: z.enum(["income", "expense"]),
    archived: z.boolean(),
  })
  .strict();
export const transactionSchema = z
  .object({
    ...stamp,
    profileId: z.string().uuid(),
    kind: z.enum(["income", "expense", "transfer", "reversal"]),
    amountMinor: moneySchema.refine((value) => value > 0),
    currency: currencySchema,
    accountId: z.string().uuid(),
    toAccountId: z.string().uuid().nullable(),
    categoryId: z.string().uuid().nullable(),
    date: dateSchema,
    description: z.string().max(500),
    reversedTransactionId: z.string().uuid().nullable(),
    billPaymentId: z.string().uuid().nullable(),
  })
  .strict();
export const budgetSchema = z
  .object({
    ...stamp,
    profileId: z.string().uuid(),
    categoryId: z.string().uuid(),
    month: z.string().regex(/^\d{4}-\d{2}$/),
    currency: currencySchema,
    limitMinor: moneySchema.refine((value) => value > 0),
  })
  .strict();
export const billSchema = z
  .object({
    ...stamp,
    profileId: z.string().uuid(),
    title: z.string().min(1).max(160),
    amountMinor: moneySchema.refine((value) => value > 0),
    currency: currencySchema,
    dueDate: dateSchema,
    recurrence: z.enum(["none", "monthly", "yearly"]),
    status: z.enum(["active", "cancelled"]),
    categoryId: z.string().uuid().nullable(),
    accountId: z.string().uuid().nullable(),
  })
  .strict();
export const billPaymentSchema = z
  .object({
    ...stamp,
    profileId: z.string().uuid(),
    billId: z.string().uuid(),
    occurrenceDate: dateSchema,
    paidAt: z.string().min(1),
    transactionId: z.string().uuid().nullable(),
    reference: z.string().max(200).nullable(),
  })
  .strict();
export type AccountRecord = z.infer<typeof accountSchema>;
export type CategoryRecord = z.infer<typeof categorySchema>;
export type FinanceTransactionRecord = z.infer<typeof transactionSchema>;
export type BudgetRecord = z.infer<typeof budgetSchema>;
export type BillRecord = z.infer<typeof billSchema>;
export type BillPaymentRecord = z.infer<typeof billPaymentSchema>;
export type FinanceKind = FinanceTransactionRecord["kind"];

const zeroDecimals = new Set([
  "BIF",
  "CLP",
  "DJF",
  "GNF",
  "JPY",
  "KMF",
  "KRW",
  "MGA",
  "PYG",
  "RWF",
  "UGX",
  "VND",
  "VUV",
  "XAF",
  "XOF",
  "XPF",
]);
const threeDecimals = new Set([
  "BHD",
  "IQD",
  "JOD",
  "KWD",
  "LYD",
  "OMR",
  "TND",
]);
export function currencyPrecision(currency: string) {
  const code = currencySchema.parse(currency);
  return zeroDecimals.has(code) ? 0 : threeDecimals.has(code) ? 3 : 2;
}
/** Reject extra precision rather than rounding a financial amount. */
export function parseMinor(input: string, currency: string) {
  return parseMoneyMinor(input, currency, false);
}

/**
 * Parse an account opening balance. Unlike transaction amounts, an opening
 * balance can be zero or represent an existing overdraft. This is deliberately
 * separate from parseMinor(), which continues to require a positive amount.
 */
export function parseSignedMinor(input: string, currency: string) {
  return parseMoneyMinor(input, currency, true);
}

function parseMoneyMinor(input: string, currency: string, signed: boolean) {
  const precision = currencyPrecision(currency);
  const value = input.trim();
  const match = (
    signed ? /^([+-]?)(\d+)(?:\.(\d+))?$/ : /^(\d+)(?:\.(\d+))?$/
  ).exec(value);
  if (!match) throw new Error("invalid money");
  const sign = signed ? match[1] : "";
  const whole = signed ? match[2]! : match[1]!;
  const fraction = (signed ? match[3] : match[2]) ?? "";
  if (fraction.length > precision) throw new Error("unsupported precision");
  const scaled = `${whole}${fraction.padEnd(precision, "0")}`;
  const minor = moneySchema.parse(Number(scaled));
  if (!signed) return moneySchema.refine((number) => number > 0).parse(minor);
  const result = sign === "-" ? -minor : minor;
  return accountSchema.shape.openingBalanceMinor.parse(result);
}
export function formatMoney(
  minor: number,
  currency: string,
  locale: "en" | "fa",
) {
  const precision = currencyPrecision(currency);
  return new Intl.NumberFormat(locale === "fa" ? "fa" : "en", {
    style: "currency",
    currency,
    minimumFractionDigits: precision,
    maximumFractionDigits: precision,
  }).format(minor / 10 ** precision);
}
export function monthFor(date: Date, timeZone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
  })
    .format(date)
    .slice(0, 7);
}
function daysInMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}
/** Recurrences retain the original day where possible and clamp only missing days. */
export function billOccurrence(
  dueDate: string,
  recurrence: BillRecord["recurrence"],
  month: string,
) {
  const [year, mon] = month.split("-").map(Number);
  const [, dueMonth, dueDay] = dueDate.split("-").map(Number);
  if (!year || !mon || !dueMonth || !dueDay) return null;
  if (recurrence === "none")
    return dueDate.slice(0, 7) === month ? dueDate : null;
  if (recurrence === "yearly" && dueMonth !== mon) return null;
  if (recurrence === "yearly" && year < Number(dueDate.slice(0, 4)))
    return null;
  if (recurrence === "monthly" && month < dueDate.slice(0, 7)) return null;
  return `${month}-${String(Math.min(dueDay, daysInMonth(year, mon))).padStart(2, "0")}`;
}
/**
 * Serialize one CSV cell for spreadsheet import. Some spreadsheet programs
 * ignore leading whitespace and Unicode format/control characters before
 * deciding whether a cell is a formula. Prefix a literal apostrophe whenever
 * such a prefix is followed by a formula sigil; otherwise preserve the user's
 * text verbatim. Quotes are escaped according to RFC 4180-style CSV rules.
 */
export function escapeCsv(value: string) {
  const safe = /^[\p{White_Space}\p{Cc}\p{Cf}]*[=+\-@]/u.test(value)
    ? `'${value}`
    : value;
  return `"${safe.replaceAll('"', '""')}"`;
}
