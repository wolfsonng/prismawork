import fs from 'fs';
import path from 'path';

type ProjectData = {
  id?: number;
  name?: string;
  studioPort?: number;
  studioUse?: 'local' | 'direct' | 'pooled';
  profiles?: any; // Store environment profiles per project
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

export function getNextProjectId(): number {
  const store = readStore();
  const existingIds = Object.values(store.items)
    .map(p => p.id)
    .filter(id => typeof id === 'number') as number[];

  if (existingIds.length === 0) return 1;
  return Math.max(...existingIds) + 1;
}

export function getProjectById(id: number): { root?: string; data?: ProjectData } {
  const store = readStore();
  for (const [root, data] of Object.entries(store.items)) {
    if (data.id === id) {
      return { root, data };
    }
  }
  return {};
}

export function setCurrentProjectById(id: number): boolean {
  const project = getProjectById(id);
  if (project.root) {
    setCurrentRoot(project.root);
    return true;
  }
  return false;
}

export function getDefaultProject(): { root?: string; data?: ProjectData } {
  // Try to load project with ID 1, fallback to first available project
  const project1 = getProjectById(1);
  if (project1.root) return project1;

  const store = readStore();
  const firstRoot = Object.keys(store.items)[0];
  if (firstRoot) {
    return { root: firstRoot, data: store.items[firstRoot] };
  }

  return {};
}

