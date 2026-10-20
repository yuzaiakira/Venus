import { browser } from "wxt/browser";
import type { BrowserBookmarkPort } from "../application/productivity";
import { canonicalHttpUrl } from "../domain/productivity";
import type { BrowserBookmarkNode } from "../domain/productivity";

interface NativeNode {
  id: string;
  title: string;
  url?: string;
  children?: NativeNode[];
}

function mapNode(node: NativeNode): BrowserBookmarkNode {
  const mapped: BrowserBookmarkNode = { id: node.id, title: node.title };
  if (node.url) mapped.url = node.url;
  if (node.children) mapped.children = node.children.map(mapNode);
  return mapped;
}

export const browserBookmarks: BrowserBookmarkPort = {
  async permission() {
    if (!browser.permissions?.contains) return "unsupported";
    const granted = await browser.permissions.contains({
      permissions: ["bookmarks"],
    });
    return granted ? "granted" : "missing";
  },
  async tree() {
    const nodes = (await browser.bookmarks.getTree()) as NativeNode[];
    return nodes.map(mapNode);
  },
  async create(input) {
    const details: { title: string; parentId?: string; url?: string } = {
      title: input.title,
    };
    if (input.parentId) details.parentId = input.parentId;
    if (input.url) details.url = canonicalHttpUrl(input.url);
    await browser.bookmarks.create(details);
  },
  async update(id, patch) {
    const changes: { title?: string; url?: string } = {};
    if (patch.title !== undefined) changes.title = patch.title;
    if (patch.url !== undefined) changes.url = canonicalHttpUrl(patch.url);
    await browser.bookmarks.update(id, changes);
  },
  async move(id, parentId) {
    await browser.bookmarks.move(id, { parentId });
  },
  async remove(id) {
    await browser.bookmarks.removeTree(id);
  },
  async request() {
    if (!browser.permissions?.request) return "unsupported";
    try {
      const granted = await browser.permissions.request({
        permissions: ["bookmarks"],
      });
      return granted ? "granted" : "denied";
    } catch (error) {
      const text = error instanceof Error ? error.message : String(error);
      if (/gesture|user input|dismiss|closed/i.test(text)) return "dismissed";
      return "failed";
    }
  },
  async revoke() {
    if (!browser.permissions?.remove) return "unsupported";
    try {
      await browser.permissions.remove({ permissions: ["bookmarks"] });
      return "revoked";
    } catch {
      return "failed";
    }
  },
};
