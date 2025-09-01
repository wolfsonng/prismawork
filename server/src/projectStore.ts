import fs from 'fs';
import path from 'path';

type ProjectData = {
  name?: string;
  studioPort?: number;
  studioUse?: 'local' | 'direct' | 'pooled';
};

type Store = {
  currentRoot?: string;
  items: Record<string, ProjectData>;
};

const DATA_DIR = path.resolve(process.cwd(), 'server', 'data');
const STORE_FILE = path.join(DATA_DIR, 'projects.json');

function ensureDir() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

export function readStore(): Store {
  try {
    if (!fs.existsSync(STORE_FILE)) return { currentRoot: undefined, items: {} };
    const raw = fs.readFileSync(STORE_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    if (!parsed.items) parsed.items = {};
    return parsed as Store;
  } catch {
    return { currentRoot: undefined, items: {} };
  }
}

export function writeStore(store: Store) {
  ensureDir();
  fs.writeFileSync(STORE_FILE, JSON.stringify(store, null, 2));
}

export function getProject(root: string): ProjectData {
  const store = readStore();
  return store.items[root] || {};
}

export function setProject(root: string, data: Partial<ProjectData>) {
  const store = readStore();
  store.items[root] = { ...store.items[root], ...data };
  writeStore(store);
}

export function setCurrentRoot(root: string) {
  const store = readStore();
  store.currentRoot = root;
  if (!store.items[root]) store.items[root] = {};
  writeStore(store);
}

export function getCurrent(): { root?: string; data?: ProjectData } {
  const store = readStore();
  const root = store.currentRoot;
  return { root, data: root ? store.items[root] : undefined };
}

