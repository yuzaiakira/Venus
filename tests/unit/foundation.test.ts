import { describe, expect, it } from "vitest";
import {
  ProbeSchema,
  diagnostic,
  reconcile,
  safeUrl,
} from "../../src/domain/foundation";
import { db, saveProbe, claimProbe } from "../../src/infrastructure/db";
const fixture = {
  id: "f535d2b1-f815-41d9-9e61-2d2518ce30b8",
  dueAt: 1000,
  state: "pending" as const,
  native: "not_attempted" as const,
};
describe("P00 foundation", () => {
  it("rejects imported execution fields and invalid timestamps", () => {
    expect(() => ProbeSchema.parse({ ...fixture, script: "evil" })).toThrow();
    expect(() => ProbeSchema.parse({ ...fixture, dueAt: Infinity })).toThrow();
  });
  it("rejects scripting URLs and accepts local navigation destinations", () => {
    for (const url of [
      "javascript:alert(1)",
      "data:text/html,x",
      "file:///tmp/x",
    ])
      expect(() => safeUrl(url)).toThrow();
    expect(safeUrl("https://example.invalid")).toBe("https://example.invalid/");
  });
  it("recovers missed probes without rewriting terminal history", () => {
    expect(reconcile(fixture, 2000).state).toBe("missed");
    expect(reconcile({ ...fixture, state: "due" }, 2000).state).toBe("due");
    expect(reconcile(fixture, 500).state).toBe("pending");
  });
  it("redacts by collecting only approved codes and times", () => {
    expect(diagnostic("permissionDenied", 10)).toEqual({
      code: "permissionDenied",
      at: 10,
    });
  });
  it("persists through connection reopen and atomically deduplicates competing claims", async () => {
    await db.probes.clear();
    await saveProbe(fixture);
    db.close();
    await db.open();
    expect(await db.probes.get(fixture.id)).toEqual(fixture);
    const claims = await Promise.all([
      claimProbe(fixture.id),
      claimProbe(fixture.id),
    ]);
    expect(claims.filter(Boolean)).toHaveLength(1);
    expect((await db.probes.get(fixture.id))?.state).toBe("due");
    await db.probes.clear();
  });
});
