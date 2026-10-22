import { describe, expect, it } from "vitest";
import {
  billOccurrence,
  currencyPrecision,
  escapeCsv,
  formatMoney,
  parseMinor,
} from "../../src/domain/finance";

describe("Finance money and recurrence rules", () => {
  it("parses exact minor units without float rounding and formats ISO precisions", () => {
    expect(parseMinor("12.34", "USD")).toBe(1234);
    expect(parseMinor("5", "JPY")).toBe(5);
    expect(parseMinor("1.234", "KWD")).toBe(1234);
    expect(currencyPrecision("JPY")).toBe(0);
    expect(currencyPrecision("KWD")).toBe(3);
    expect(() => parseMinor("1.001", "USD")).toThrow();
    expect(() => parseMinor("90071992547409999", "USD")).toThrow();
    expect(formatMoney(1234, "USD", "en")).toContain("12.34");
  });
  it("clamps monthly and yearly commitment dates deterministically", () => {
    expect(billOccurrence("2024-01-31", "monthly", "2024-02")).toBe(
      "2024-02-29",
    );
    expect(billOccurrence("2024-02-29", "yearly", "2025-02")).toBe(
      "2025-02-28",
    );
    expect(billOccurrence("2024-02-29", "yearly", "2028-02")).toBe(
      "2028-02-29",
    );
  });
  it("prevents CSV spreadsheet formula injection", () => {
    expect(escapeCsv("=SUM(A1:A2)")).toBe('"\'=SUM(A1:A2)"');
    expect(escapeCsv('plain "text"')).toBe('"plain ""text"""');
  });
});
