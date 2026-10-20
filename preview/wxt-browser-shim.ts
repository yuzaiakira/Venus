/** Browser API shim for temporary UI preview (not an extension).
 * storage.local persists to localStorage so refresh keeps preferences
 * such as onboardingComplete. Session storage stays in-memory.
 */

const LOCAL_STORAGE_KEY = "venus.preview.storage.local";

function loadLocalStore(): Map<string, unknown> {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return new Map();
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return new Map(Object.entries(parsed));
  } catch {
    return new Map();
  }
}

function persistLocalStore(store: Map<string, unknown>) {
  try {
    localStorage.setItem(
      LOCAL_STORAGE_KEY,
      JSON.stringify(Object.fromEntries(store.entries())),
    );
  } catch {
    // Quota or private-mode failures must not break the preview shell.
  }
}

const memory = loadLocalStore();
const session = new Map<string, unknown>();
const listeners = new Set<(changes: unknown, area: string) => void>();

function mapFrom(store: Map<string, unknown>, keys?: string | string[] | null) {
  if (keys == null) {
    return Object.fromEntries(store.entries());
  }
  const list = Array.isArray(keys) ? keys : [keys];
  const out: Record<string, unknown> = {};
  for (const key of list) {
    if (store.has(key)) out[key] = store.get(key);
  }
  return out;
}

export const browser = {
  storage: {
    local: {
      async get(keys?: string | string[] | null) {
        return mapFrom(memory, keys);
      },
      async set(values: Record<string, unknown>) {
        const changes: Record<string, { oldValue: unknown; newValue: unknown }> =
          {};
        for (const [key, value] of Object.entries(values)) {
          changes[key] = { oldValue: memory.get(key), newValue: value };
          memory.set(key, value);
        }
        persistLocalStore(memory);
        listeners.forEach((listener) => listener(changes, "local"));
      },
      async remove(keys: string | string[]) {
        for (const key of Array.isArray(keys) ? keys : [keys]) memory.delete(key);
        persistLocalStore(memory);
      },
      async clear() {
        memory.clear();
        persistLocalStore(memory);
      },
    },
    session: {
      async get(keys?: string | string[] | null) {
        return mapFrom(session, keys);
      },
      async set(values: Record<string, unknown>) {
        for (const [key, value] of Object.entries(values)) session.set(key, value);
      },
    },
    onChanged: {
      addListener(listener: (changes: unknown, area: string) => void) {
        listeners.add(listener);
      },
      removeListener(listener: (changes: unknown, area: string) => void) {
        listeners.delete(listener);
      },
    },
  },
  alarms: {
    async create() {},
    async getAll() {
      return [];
    },
    async clear() {
      return true;
    },
  },
  notifications: {
    async create() {
      return "preview";
    },
  },
  permissions: {
    async contains() {
      return false;
    },
    async request() {
      return false;
    },
    async remove() {
      return true;
    },
  },
  bookmarks: {
    async getTree() {
      return [];
    },
    async create() {
      return { id: "preview", title: "preview" };
    },
    async update() {},
    async move() {},
    async remove() {},
    async removeTree() {},
  },
  runtime: {
    getURL(path: string) {
      return path;
    },
    id: "venus-preview",
  },
};
