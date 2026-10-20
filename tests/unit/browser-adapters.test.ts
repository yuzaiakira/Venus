import { beforeEach, describe, expect, it, vi } from "vitest";
const api = vi.hoisted(() => ({
  permissions: { contains: vi.fn(), request: vi.fn(), remove: vi.fn() },
  bookmarks: {
    getTree: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
  },
  notifications: { create: vi.fn() },
  runtime: {
    getURL: vi.fn((path: string) => `moz-extension://synthetic${path}`),
  },
}));
vi.mock("wxt/browser", () => ({ browser: api }));
import {
  bookmarks,
  notifications,
  permission,
} from "../../src/infrastructure/browser";
beforeEach(() => {
  vi.resetAllMocks();
  api.runtime.getURL.mockImplementation(
    (path) => `moz-extension://synthetic${path}`,
  );
});
describe("browser port negative paths (API doubles)", () => {
  it("does not read or mutate bookmarks when permission is denied", async () => {
    api.permissions.contains.mockResolvedValue(false);
    await expect(bookmarks.probe()).rejects.toThrow("permissionDenied");
    expect(api.bookmarks.getTree).not.toHaveBeenCalled();
    expect(api.bookmarks.create).not.toHaveBeenCalled();
  });
  it("cleans up only its own synthetic bookmark even when update fails", async () => {
    api.permissions.contains.mockResolvedValue(true);
    api.bookmarks.create.mockResolvedValue({ id: "fixture-only" });
    api.bookmarks.update.mockRejectedValue(new Error("fixture API failure"));
    await expect(bookmarks.probe()).rejects.toThrow();
    expect(api.bookmarks.remove).toHaveBeenCalledExactlyOnceWith(
      "fixture-only",
    );
  });
  it("keeps notification denial separate from a native display claim", async () => {
    api.permissions.contains.mockResolvedValue(false);
    expect(await notifications.show("fixture")).toBe("blocked");
    expect(api.notifications.create).not.toHaveBeenCalled();
  });
  it("records API acceptance without claiming OS visibility", async () => {
    api.permissions.contains.mockResolvedValue(true);
    api.notifications.create.mockResolvedValue("fixture");
    expect(await notifications.show("fixture")).toBe("api_accepted");
    expect(api.notifications.create).toHaveBeenCalledWith(
      "fixture",
      expect.objectContaining({
        iconUrl: "moz-extension://synthetic/icons/icon.png",
      }),
    );
  });
  it("contains native API exceptions and handles subsequent revocation", async () => {
    api.permissions.contains
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false);
    api.notifications.create.mockRejectedValue(new Error("OS blocked"));
    expect(await notifications.show("fixture")).toBe("failed");
    expect(await notifications.show("fixture")).toBe("blocked");
  });
  it("requests optional permissions explicitly and never turns revoke into grant", async () => {
    api.permissions.request.mockResolvedValue(false);
    api.permissions.remove.mockResolvedValue(true);
    expect(await permission("bookmarks", true)).toBe(false);
    expect(await permission("bookmarks", false)).toBe(true);
    expect(api.permissions.request).toHaveBeenCalledExactlyOnceWith({
      permissions: ["bookmarks"],
    });
    expect(api.permissions.remove).toHaveBeenCalledExactlyOnceWith({
      permissions: ["bookmarks"],
    });
  });
});
