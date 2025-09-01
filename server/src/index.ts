import express from 'express';
import cors from 'cors';
import { envStateSchema, testConnectionBody, diffEndpointBody } from './validation';
import { loadEnvState, saveEnvState, resolveRuntimeEnv, type EnvState } from './envFile';
import { startPrismaTask, getTask, startTask } from './tasks';
import { tryConnect, listExtensions } from './pgUtil';
import { spawn, spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { readDotEnv, writeDotEnv } from './envFile';
import { readStore, writeStore, getProject, setProject, setCurrentRoot, getCurrent, getNextProjectId, getProjectById, setCurrentProjectById, getDefaultProject } from './projectStore';

// moved tryConnect to pgUtil

const app = express();
app.use(express.json());
app.use(
  cors({
    origin: (origin, cb) => {
      // Allow Vite default local origins
      if (!origin) return cb(null, true);
      if (/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin)) {
        return cb(null, true);
      }
      return cb(new Error('Not allowed by CORS'));
    },
    credentials: false,
  })
);

function getProjectEnvState(): EnvState | null {
  try {
    const cur = getCurrent();
    if (!cur.root) return null;
    const proj = getProject(cur.root) as any;
    if (proj && proj.profiles && proj.profiles.ACTIVE_PROFILE) return proj.profiles as EnvState;
    return null;
  } catch { return null; }
}

function saveProjectEnvState(state: EnvState): boolean {
  try {
    const cur = getCurrent();
    if (!cur.root) return false;
    setProject(cur.root, { profiles: state });
    return true;
  } catch { return false; }
}

function getRuntimeEnv() {
  const state = getProjectEnvState() || loadEnvState();
  return resolveRuntimeEnv(state);
}

// ---- Env profile routes ----
app.get('/api/env/active-profile', (_req, res) => {
  const state = getProjectEnvState() || loadEnvState();
  res.json(state);
});

app.post('/api/env/save-profile', (req, res) => {
  const parsed = envStateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  // Try to save to current project first, fallback to global .env
  const success = saveProjectEnvState(parsed.data);
  if (!success) {
    saveEnvState(parsed.data);
  }
  res.json({ ok: true });
});

// ---- Connection tester ----
app.post('/api/profiles/test-connection', async (req, res) => {
  const parsed = testConnectionBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const result = await tryConnect(parsed.data.url);
  res.json(result);
});

// ---- Prisma commands (return taskId; stream via SSE) ----
app.get('/api/prisma/status', (_req, res) => {
  const direct = getRuntimeEnv().DIRECT_URL;
  const { id } = startPrismaTask(['migrate', 'status'], { DATABASE_URL: direct, DIRECT_URL: direct });
  res.json({ taskId: id });
});

app.post('/api/prisma/migrate-dev', (_req, res) => {
  // Use local db + shadow
  const runtime = getRuntimeEnv();
  const local = runtime.LOCAL_DATABASE_URL;
  const shadow = runtime.SHADOW_DATABASE_URL;
  const { id } = startPrismaTask(['migrate', 'dev'], { DATABASE_URL: local, SHADOW_DATABASE_URL: shadow });
  res.json({ taskId: id });
});

app.post('/api/prisma/migrate-deploy', (_req, res) => {
  // Use direct url for deploy; set both to be safe
  const direct = getRuntimeEnv().DIRECT_URL;
  const { id } = startPrismaTask(['migrate', 'deploy'], {
    DIRECT_URL: direct,
    DATABASE_URL: direct,
  });
  res.json({ taskId: id });
});

app.post('/api/prisma/db-pull', (_req, res) => {
  const direct = getRuntimeEnv().DIRECT_URL;
  const { id } = startPrismaTask(['db', 'pull'], { DIRECT_URL: direct, DATABASE_URL: direct });
  res.json({ taskId: id });
});

app.post('/api/prisma/generate', (_req, res) => {
  const { id } = startPrismaTask(['generate']);
  res.json({ taskId: id });
});

app.post('/api/prisma/format', (_req, res) => {
  const { id } = startPrismaTask(['format']);
  res.json({ taskId: id });
});

app.post('/api/prisma/diff', (_req, res) => {
  // Show SQL plan from DIRECT_URL to local schema
  const direct = resolveRuntimeEnv(loadEnvState()).DIRECT_URL;
  const { id } = startPrismaTask(['migrate', 'diff', '--from-url', direct, '--to-schema-datamodel', 'prisma/schema.prisma', '--script'], {
    DIRECT_URL: direct,
    DATABASE_URL: direct,
  });
  res.json({ taskId: id });
});

// ---- Prisma Studio (start/stop/status) ----
let studio: { proc: ReturnType<typeof spawnSync> | any; port: number; cwd: string } | null = null;

app.get('/api/prisma/studio/status', (_req, res) => {
  if (!studio) return res.json({ running: false });
  const running = !!studio && !studio.proc.killed;
  res.json({ running, port: studio.port, url: `http://localhost:${studio.port}`, cwd: studio.cwd });
});

app.post('/api/prisma/studio/start', express.json(), (req, res) => {
  if (studio && !studio.proc.killed) return res.json({ ok: true, already: true, port: studio.port, url: `http://localhost:${studio.port}` });
  const { port, use } = (req.body || {}) as { port?: number; use?: 'local'|'direct'|'pooled' };
  const envMap = readDotEnv();
  const cwd = envMap.PROJECT_ROOT || envMap.SCRIPTS_CWD || envMap.SEEDS_CWD || process.cwd();
  const p = Number(port || 5555);
  const args = ['prisma', 'studio', '--port', String(p), '--browser', 'none', '--schema', 'prisma/schema.prisma'];
  const rt = getRuntimeEnv();
  const url = use === 'direct' ? rt.DIRECT_URL : use === 'pooled' ? rt.DATABASE_URL : rt.LOCAL_DATABASE_URL || rt.DIRECT_URL || rt.DATABASE_URL;
  const env = { ...process.env as any, DATABASE_URL: url || process.env.DATABASE_URL };
  const proc = spawn(process.platform === 'win32' ? 'npx.cmd' : 'npx', args, { cwd, env });
  studio = { proc, port: p, cwd } as any;
  proc.on('exit', () => { studio = null; });
  res.json({ ok: true, port: p, url: `http://localhost:${p}` });
});

app.post('/api/prisma/studio/stop', (_req, res) => {
  if (studio && !studio.proc.killed) {
    try { studio.proc.kill(); } catch {}
    studio = null;
    return res.json({ ok: true, stopped: true });
  }
  res.json({ ok: true, stopped: false });
});

// ---- Project registry ----
app.get('/api/projects', (_req, res) => {
  res.json(readStore());
});

app.get('/api/projects/current', (_req, res) => {
  res.json(getCurrent());
});

app.post('/api/projects/select', express.json(), (req, res) => {
  const { root, name } = (req.body || {}) as { root?: string; name?: string };
  if (!root) return res.status(400).json({ error: 'root required' });
  setCurrentRoot(root);
  if (name) setProject(root, { name });
  // also persist to .env for backward compatibility
  const env = readDotEnv();
  env.PROJECT_ROOT = root;
  env.SCRIPTS_CWD = root;
  env.SEEDS_CWD = root;
  writeDotEnv(env);
  res.json({ ok: true, root });
});

app.post('/api/projects/update', express.json(), (req, res) => {
  const { root, data, id, name, path } = (req.body || {}) as {
    root?: string;
    data?: any;
    id?: number;
    name?: string;
    path?: string;
  };

  // Handle project update by ID (new format) - check this first
  if (id !== undefined && (name !== undefined || path !== undefined)) {
    const project = getProjectById(id);
    if (!project.root) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const store = readStore();
    const currentData = store.items[project.root];

    // If path is changing, we need to move the project
    if (path && path !== project.root) {
      // Check if new path already exists
      if (store.items[path]) {
        return res.status(400).json({ error: 'Project with this path already exists' });
      }

      // Move project to new path
      store.items[path] = {
        ...currentData,
        name: name !== undefined ? name : currentData.name,
        id: currentData.id
      };
      delete store.items[project.root];

      // Update current root if this was the current project
      if (store.currentRoot === project.root) {
        store.currentRoot = path;
      }
    } else {
      // Just update the name
      store.items[project.root] = {
        ...currentData,
        name: name !== undefined ? name : currentData.name
      };
    }

    writeStore(store);
    res.json({ ok: true });
    return;
  }

  // Handle legacy format
  if (!root || !data) return res.status(400).json({ error: 'root and data required' });
  setProject(root, data);
  res.json({ ok: true });
});

// ---- New project management endpoints ----
app.get('/api/projects/default', (_req, res) => {
  const defaultProject = getDefaultProject();
  res.json(defaultProject);
});

app.post('/api/projects/create', express.json(), (req, res) => {
  const { root, name } = (req.body || {}) as { root?: string; name?: string };
  if (!root) return res.status(400).json({ error: 'root required' });

  // Check if project with this root already exists
  const store = readStore();
  if (store.items[root]) {
    return res.status(400).json({ error: 'Project with this directory already exists' });
  }

  const nextId = getNextProjectId();
  const projectData = {
    id: nextId,
    name: name || `Project ${nextId}`,
    studioPort: 5555,
    studioUse: 'local' as const,
    profiles: {
      ACTIVE_PROFILE: 'local' as const,
      profiles: {
        local: {
          LOCAL_DATABASE_URL: '',
          SHADOW_DATABASE_URL: '',
          DATABASE_URL: '',
          DIRECT_URL: ''
        },
        staging: {
          LOCAL_DATABASE_URL: '',
          SHADOW_DATABASE_URL: '',
          DATABASE_URL: '',
          DIRECT_URL: ''
        },
        prod: {
          LOCAL_DATABASE_URL: '',
          SHADOW_DATABASE_URL: '',
          DATABASE_URL: '',
          DIRECT_URL: ''
        }
      }
    }
  };

  setProject(root, projectData);
  setCurrentRoot(root);

  res.json({ ok: true, id: nextId, project: projectData });
});

app.post('/api/projects/switch', express.json(), (req, res) => {
  const { id } = (req.body || {}) as { id?: number };
  if (typeof id !== 'number') return res.status(400).json({ error: 'id required' });

  const success = setCurrentProjectById(id);
  if (success) {
    res.json({ ok: true, id });
  } else {
    res.status(404).json({ error: 'Project not found' });
  }
});

app.get('/api/projects/by-id/:id', (req, res) => {
  const { id } = req.params as { id: string };
  const projectId = parseInt(id, 10);
  if (isNaN(projectId)) return res.status(400).json({ error: 'Invalid ID' });

  const project = getProjectById(projectId);
  if (project.root) {
    res.json(project);
  } else {
    res.status(404).json({ error: 'Project not found' });
  }
});

app.post('/api/projects/delete', express.json(), (req, res) => {
  const { id } = (req.body || {}) as { id?: number };
  if (typeof id !== 'number') return res.status(400).json({ error: 'id required' });

  const store = readStore();
  const projectToDelete = getProjectById(id);

  if (!projectToDelete.root) {
    return res.status(404).json({ error: 'Project not found' });
  }

  // Don't allow deleting the last project
  if (Object.keys(store.items).length <= 1) {
    return res.status(400).json({ error: 'Cannot delete the last project' });
  }

  // Remove the project
  delete store.items[projectToDelete.root];

  // If this was the current project, switch to another one
  if (store.currentRoot === projectToDelete.root) {
    const remainingProjects = Object.keys(store.items);
    if (remainingProjects.length > 0) {
      store.currentRoot = remainingProjects[0];
    } else {
      store.currentRoot = undefined;
    }
  }

  writeStore(store);
  res.json({ ok: true });
});


// ---- SSE streaming for a task ----
app.get('/api/stream/:taskId', (req, res) => {
  const { taskId } = req.params as { taskId: string };
  const task = getTask(taskId);
  if (!task) return res.status(404).end();

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  const send = (type: string, payload: any) => {
    res.write(`event: ${type}\n`);
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
  };

  // Send past logs first
  for (const entry of task.logs) {
    send('log', entry);
  }
  if (task.done) send('done', { exitCode: task.exitCode });

  const onStdout = (d: Buffer) => send('log', { type: 'stdout', message: d.toString(), ts: Date.now() });
  const onStderr = (d: Buffer) => send('log', { type: 'stderr', message: d.toString(), ts: Date.now() });
  const onClose = (code: number | null) => {
    send('done', { exitCode: code === null ? -1 : code });
    res.end();
  };

  task.proc.stdout.on('data', onStdout);
  task.proc.stderr.on('data', onStderr);
  task.proc.on('close', onClose);

  req.on('close', () => {
    task.proc.stdout.off('data', onStdout);
    task.proc.stderr.off('data', onStderr);
    task.proc.off('close', onClose);
  });
});

// ---- Pre-deploy checklist ----
app.post('/api/safety/predeploy-check', async (_req, res) => {
  const rt = getRuntimeEnv();

  const [local, shadow, direct, pooled] = await Promise.all([
    rt.LOCAL_DATABASE_URL ? tryConnect(rt.LOCAL_DATABASE_URL) : Promise.resolve({ ok: false, latencyMs: 0, error: 'LOCAL_DATABASE_URL missing' }),
    rt.SHADOW_DATABASE_URL ? tryConnect(rt.SHADOW_DATABASE_URL) : Promise.resolve({ ok: false, latencyMs: 0, error: 'SHADOW_DATABASE_URL missing' }),
    rt.DIRECT_URL ? tryConnect(rt.DIRECT_URL) : Promise.resolve({ ok: false, latencyMs: 0, error: 'DIRECT_URL missing' }),
    rt.DATABASE_URL ? tryConnect(rt.DATABASE_URL) : Promise.resolve({ ok: false, latencyMs: 0, error: 'DATABASE_URL missing' }),
  ]);

  // git clean check
  const git = spawnSync('git', ['status', '--porcelain'], { encoding: 'utf8' });
  const gitClean = git.status === 0 && (git.stdout || '').trim().length === 0;

  // pending migrations (text) against target deploy (DIRECT_URL)
  const status = spawnSync(
    process.platform === 'win32' ? 'npx.cmd' : 'npx',
    ['prisma', 'migrate', 'status', '--schema', 'prisma/schema.prisma'],
    { encoding: 'utf8', env: { ...process.env as any, DATABASE_URL: rt.DIRECT_URL, DIRECT_URL: rt.DIRECT_URL } }
  );

  // naive parse
  const stdout = status.stdout || '';
  const upToDate = /up to date/i.test(stdout) || /No pending migrations/i.test(stdout);
  const pending: string[] = [];
  const startIdx = stdout.indexOf('have not yet been applied');
  if (startIdx >= 0) {
    const after = stdout.slice(startIdx).split(/\r?\n/).slice(1, 20); // read next lines
    for (const line of after) {
      const m = line.match(/\s*-\s*(.+)/);
      if (m) pending.push(m[1].trim());
      else if (!line.trim()) break;
    }
  }

  res.json({
    connections: { local, shadow, direct, pooled },
    git: { clean: gitClean, error: git.status !== 0 ? git.stderr : undefined },
    prismaStatus: { code: status.status, stdout: status.stdout, stderr: status.stderr, upToDate, pending },
  });
});

// ---- Backup via pg_dump ----
app.post('/api/backup/pgdump', express.json(), (req, res) => {
  try {
    const { outDir } = (req.body || {}) as { outDir?: string };
    const rt = resolveRuntimeEnv(loadEnvState());
    const direct = rt.DIRECT_URL;
    if (!direct) return res.status(400).json({ error: 'DIRECT_URL missing' });
    const envMap = readDotEnv();
    const pgDumpPath = envMap.PG_DUMP_PATH || process.env.PG_DUMP_PATH || 'pg_dump';
    const out = path.resolve(process.cwd(), outDir || 'backups');
    fs.mkdirSync(out, { recursive: true });
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const file = path.join(out, `pgdump_${ts}.sql`);
    const args = ['-f', file, '--no-owner', '--no-privileges', '--format=plain', direct];
    const r = spawnSync(pgDumpPath, args, { encoding: 'utf8', env: { ...process.env as any, PGSSLROOTCERT: envMap.PG_SSL_CA_PATH || '' } });
    if (r.status !== 0) return res.status(500).json({ error: r.stderr || 'pg_dump failed', cmd: `${pgDumpPath} ${args.join(' ')}` });
    res.json({ ok: true, file });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || String(e) });
  }
});

// ---- Read local file (text) ----
app.post('/api/files/read', express.json(), (req, res) => {
  try {
    const { path: p } = (req.body || {}) as { path?: string };
    if (!p) return res.status(400).json({ error: 'path required' });
    const full = path.resolve(process.cwd(), p);
    if (!fs.existsSync(full)) return res.status(404).json({ error: 'not found' });
    const content = fs.readFileSync(full, 'utf8');
    res.json({ path: full, content });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || String(e) });
  }
});

// ---- Native file picker (best-effort, local only) ----
app.post('/api/system/choose-file', express.json(), (req, res) => {
  const prompt = (req.body && (req.body.prompt as string)) || 'Select a file';
  const platform = process.platform;
  try {
    if (platform === 'darwin') {
      const script = `POSIX path of (choose file with prompt \"${prompt.replace(/"/g, '\\"')}\")`;
      const r = spawnSync('osascript', ['-e', script], { encoding: 'utf8' });
      if (r.status === 0 && r.stdout.trim()) return res.json({ path: r.stdout.trim() });
      return res.status(500).json({ error: r.stderr || 'File chooser cancelled or failed' });
    }
    if (platform === 'win32') {
      const ps = `Add-Type -AssemblyName System.Windows.Forms; $f = New-Object System.Windows.Forms.OpenFileDialog; $f.Title='${prompt.replace(/'/g, "''")}'; $null = $f.ShowDialog(); [Console]::Out.WriteLine($f.FileName)`;
      const r = spawnSync('powershell', ['-NoProfile', '-Command', ps], { encoding: 'utf8' });
      if (r.status === 0 && r.stdout.trim()) return res.json({ path: r.stdout.trim() });
      return res.status(500).json({ error: r.stderr || 'File chooser cancelled or failed' });
    }
    let r = spawnSync('zenity', ['--file-selection', `--title=${prompt}`], { encoding: 'utf8' });
    if (r.status === 0 && r.stdout.trim()) return res.json({ path: r.stdout.trim() });
    r = spawnSync('kdialog', ['--getopenfilename'], { encoding: 'utf8' });
    if (r.status === 0 && r.stdout.trim()) return res.json({ path: r.stdout.trim() });
    return res.status(501).json({ error: 'File dialog not available on this system' });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || String(e) });
  }
});

// ---- Settings: read/update PG_DUMP_PATH and PG_SSL_CA_PATH ----
app.get('/api/settings', (_req, res) => {
  const env = readDotEnv();
  res.json({
    PG_DUMP_PATH: env.PG_DUMP_PATH || '',
    PG_SSL_CA_PATH: env.PG_SSL_CA_PATH || '',
    PG_SSL_VERIFY: env.PG_SSL_VERIFY === 'true',
    PROJECT_ROOT: env.PROJECT_ROOT || '',
    SEEDS_CWD: env.SEEDS_CWD || '',
    SCRIPTS_CWD: env.SCRIPTS_CWD || '',
  });
});

app.post('/api/settings', express.json(), (req, res) => {
  const body = (req.body || {}) as { PG_DUMP_PATH?: string; PG_SSL_CA_PATH?: string; PG_SSL_VERIFY?: boolean; PROJECT_ROOT?: string; SEEDS_CWD?: string; SCRIPTS_CWD?: string };
  const env = readDotEnv();
  if (body.PG_DUMP_PATH !== undefined) env.PG_DUMP_PATH = body.PG_DUMP_PATH;
  if (body.PG_SSL_CA_PATH !== undefined) env.PG_SSL_CA_PATH = body.PG_SSL_CA_PATH;
  if (body.PG_SSL_VERIFY !== undefined) env.PG_SSL_VERIFY = body.PG_SSL_VERIFY ? 'true' : 'false';
  if (body.PROJECT_ROOT !== undefined) env.PROJECT_ROOT = body.PROJECT_ROOT;
  if (body.SEEDS_CWD !== undefined) env.SEEDS_CWD = body.SEEDS_CWD;
  if (body.SCRIPTS_CWD !== undefined) env.SCRIPTS_CWD = body.SCRIPTS_CWD;
  writeDotEnv(env);
  res.json({ ok: true });
});

// ---- Upload certificate (CA) ----
app.post('/api/certs/upload', express.json({ limit: '10mb' }), (req, res) => {
  const { filename, contentBase64, setAsDefault } = (req.body || {}) as { filename?: string; contentBase64?: string; setAsDefault?: boolean };
  if (!filename || !contentBase64) return res.status(400).json({ error: 'filename and contentBase64 required' });
  const safe = filename.replace(/[^a-zA-Z0-9_.-]/g, '_');
  const dir = path.resolve(process.cwd(), 'cert');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, safe);
  try {
    const buf = Buffer.from(contentBase64, 'base64');
    fs.writeFileSync(file, buf);
    if (setAsDefault) {
      const env = readDotEnv();
      env.PG_SSL_CA_PATH = file;
      writeDotEnv(env);
    }
    res.json({ ok: true, path: file });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || String(e) });
  }
});

// ---- System versions ----
app.get('/api/system/versions', async (_req, res) => {
  const rt = getRuntimeEnv();
  const prismaV = spawnSync(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['prisma', '-v'], { encoding: 'utf8' });
  const localV = rt.LOCAL_DATABASE_URL ? await tryConnect(rt.LOCAL_DATABASE_URL) : null;
  const directV = rt.DIRECT_URL ? await tryConnect(rt.DIRECT_URL) : null;
  res.json({
    node: process.version,
    prisma: prismaV.stdout || prismaV.stderr,
    postgres: {
      local: localV?.serverVersion || null,
      direct: directV?.serverVersion || null,
      localMajor: localV?.serverVersion ? (localV.serverVersion.match(/PostgreSQL\s+(\d+(?:\.\d+)?)/)?.[1] || null) : null,
      directMajor: directV?.serverVersion ? (directV.serverVersion.match(/PostgreSQL\s+(\d+(?:\.\d+)?)/)?.[1] || null) : null,
    },
  });
});

// extensions listing per target
app.get('/api/system/extensions', async (req, res) => {
  const target = String((req.query.target || 'local')).toLowerCase();
  const rt = getRuntimeEnv();
  const map: any = {
    local: rt.LOCAL_DATABASE_URL,
    shadow: rt.SHADOW_DATABASE_URL,
    direct: rt.DIRECT_URL,
    pooled: rt.DATABASE_URL,
  };
  const url = map[target];
  if (!url) return res.status(400).json({ error: `URL for target '${target}' missing` });
  const result = await listExtensions(url);
  res.json({ target, ...result });
});

// SQL diff preview as plain text (non-streaming)
app.get('/api/prisma/diff-preview', (_req, res) => {
  const direct = getRuntimeEnv().DIRECT_URL;
  const proc = spawnSync(
    process.platform === 'win32' ? 'npx.cmd' : 'npx',
    ['prisma', 'migrate', 'diff', '--from-url', direct, '--to-schema-datamodel', 'prisma/schema.prisma', '--script'],
    { encoding: 'utf8', env: { ...process.env as any, DATABASE_URL: direct, DIRECT_URL: direct } }
  );
  const sql = proc.stdout || proc.stderr || '';
  res.json({ code: proc.status, sql });
});

app.post('/api/prisma/diff-preview', express.json(), (req, res) => {
  const parsed = diffEndpointBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { from, to, cwd } = parsed.data;
  const args = ['prisma', 'migrate', 'diff', '--script'];
  const rt = getRuntimeEnv();
  const addSide = (side: 'from'|'to', v: typeof from) => {
    if (v.kind === 'url') args.push(`--${side}-url`, v.value || rt.DIRECT_URL);
    else if (v.kind === 'schema') args.push(`--${side}-schema-datamodel`, v.value || 'prisma/schema.prisma');
    else args.push(`--${side}-migrations`, v.value || 'prisma/migrations');
  };
  try {
    addSide('from', from);
    addSide('to', to);
  } catch (e: any) {
    return res.status(400).json({ error: e?.message || String(e) });
  }
  const env = { ...process.env as any, DIRECT_URL: rt.DIRECT_URL, DATABASE_URL: rt.DIRECT_URL };
  const proc = spawnSync(process.platform === 'win32' ? 'npx.cmd' : 'npx', args, { encoding: 'utf8', env, cwd: cwd || process.cwd() });
  const sql = proc.stdout || proc.stderr || '';
  res.json({ code: proc.status, sql, args });
});

// ---- Prisma db pull --print to temp file ----
app.post('/api/prisma/db-pull-print', express.json(), (req, res) => {
  try {
    const { url, use, cwd } = (req.body || {}) as { url?: string; use?: 'local'|'direct'|'pooled'; cwd?: string };
    const rt = getRuntimeEnv();
    const resolvedUrl = url || (use === 'local' ? rt.LOCAL_DATABASE_URL : use === 'pooled' ? rt.DATABASE_URL : rt.DIRECT_URL);
    if (!resolvedUrl) return res.status(400).json({ error: 'No URL provided/resolved' });
    const envMap = readDotEnv();
    const workdir = cwd || envMap.PROJECT_ROOT || envMap.SCRIPTS_CWD || envMap.SEEDS_CWD || process.cwd();
    const args = ['prisma', 'db', 'pull', '--print', '--schema', 'prisma/schema.prisma'];
    const env = { ...process.env as any, DATABASE_URL: resolvedUrl, DIRECT_URL: resolvedUrl };
    const proc = spawnSync(process.platform === 'win32' ? 'npx.cmd' : 'npx', args, { encoding: 'utf8', env, cwd: workdir, maxBuffer: 10 * 1024 * 1024 });
    const out = proc.stdout || '';
    if (proc.status !== 0 || !out) return res.status(500).json({ error: proc.stderr || 'db pull failed', code: proc.status });
    const dir = path.resolve(process.cwd(), 'tmp');
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, `schema_pull_${Date.now()}.prisma`);
    fs.writeFileSync(file, out);
    return res.json({ ok: true, path: file, bytes: out.length });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || String(e) });
  }
});

// ---- Validate project root ----
app.get('/api/system/validate-project', (req, res) => {
  const p = String(req.query.path || '');
  if (!p) return res.status(400).json({ error: 'path required' });
  const full = path.resolve(process.cwd(), p);
  const pkg = path.join(full, 'package.json');
  const schema = path.join(full, 'prisma', 'schema.prisma');
  const ok = fs.existsSync(full) && fs.existsSync(pkg) && fs.existsSync(schema);
  res.json({ ok, hasPackageJson: fs.existsSync(pkg), hasSchema: fs.existsSync(schema), full });
});

// ---- Scripts/Seeds utilities ----
app.get('/api/scripts', (req, res) => {
  const cwd = String(req.query.cwd || process.cwd());
  try {
    const pkgPath = path.join(cwd, 'package.json');
    if (!fs.existsSync(pkgPath)) return res.json({ cwd, scripts: {} });
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8')) as any;
    res.json({ cwd, scripts: pkg.scripts || {} });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || String(e) });
  }
});

app.post('/api/scripts/run', express.json(), (req, res) => {
  const { cwd, script } = (req.body || {}) as { cwd?: string; script?: string };
  if (!script) return res.status(400).json({ error: 'script required' });
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const { id } = startTask(npm, ['run', script], {}, cwd);
  res.json({ taskId: id });
});

app.post('/api/seeds/run', express.json(), (req, res) => {
  const { cwd, mode } = (req.body || {}) as { cwd?: string; mode?: 'npm-seed' | 'prisma-seed' | 'reset-and-seed' };
  const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  let cmd = npx;
  let args: string[] = [];
  if (mode === 'prisma-seed') {
    args = ['prisma', 'db', 'seed'];
  } else if (mode === 'reset-and-seed') {
    args = ['prisma', 'migrate', 'reset', '--force'];
  } else {
    // default: run npm run seed
    cmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
    args = ['run', 'seed'];
  }
  const { id } = startTask(cmd, args, {}, cwd);
  res.json({ taskId: id });
});

// ---- Save task logs to file ----
app.post('/api/tasks/:taskId/save-log', express.json(), (req, res) => {
  const { taskId } = req.params as { taskId: string };
  const task = getTask(taskId);
  if (!task) return res.status(404).json({ error: 'Task not found' });
  const { outDir } = (req.body || {}) as { outDir?: string };
  const dir = path.resolve(process.cwd(), outDir || 'logs');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `task_${taskId}.log`);
  const text = task.logs.map(l => `[${new Date(l.ts).toISOString()}] ${l.type.toUpperCase()}: ${l.message}`).join('');
  fs.writeFileSync(file, text);
  res.json({ ok: true, file });
});

// ---- List local Prisma migrations ----
app.get('/api/prisma/migrations', (_req, res) => {
  const root = path.resolve(process.cwd(), 'prisma', 'migrations');
  if (!fs.existsSync(root)) return res.json({ total: 0, items: [] });
  const entries = fs.readdirSync(root, { withFileTypes: true }).filter((d) => d.isDirectory());
  const items = entries.map((d) => {
    const dir = path.join(root, d.name);
    const st = fs.statSync(dir);
    const m = d.name.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})_(.+)$/);
    let ts = st.mtime.toISOString();
    let parsedAt: number | null = null;
    let label = d.name;
    if (m) {
      const [_, y, mo, da, h, mi, s, rest] = m;
      const iso = `${y}-${mo}-${da}T${h}:${mi}:${s}.000Z`;
      ts = iso;
      parsedAt = Date.parse(iso);
      label = rest;
    }
    return { name: d.name, label, dir, ts, parsedAt };
  }).sort((a, b) => (a.parsedAt || 0) - (b.parsedAt || 0));
  res.json({ total: items.length, items });
});

// ---- Native folder picker (best-effort, local only) ----
app.post('/api/system/choose-folder', express.json(), (req, res) => {
  const prompt = (req.body && (req.body.prompt as string)) || 'Select a folder';
  const platform = process.platform;
  try {
    if (platform === 'darwin') {
      const script = `POSIX path of (choose folder with prompt \"${prompt.replace(/"/g, '\\"')}\")`;
      const r = spawnSync('osascript', ['-e', script], { encoding: 'utf8' });
      if (r.status === 0 && r.stdout.trim()) return res.json({ path: r.stdout.trim() });
      return res.status(500).json({ error: r.stderr || 'Folder chooser cancelled or failed' });
    }
    if (platform === 'win32') {
      const ps = `Add-Type -AssemblyName System.Windows.Forms; $f = New-Object System.Windows.Forms.FolderBrowserDialog; $f.Description = '${prompt.replace(/'/g, "''")}'; $null = $f.ShowDialog(); [Console]::Out.WriteLine($f.SelectedPath)`;
      const r = spawnSync('powershell', ['-NoProfile', '-Command', ps], { encoding: 'utf8' });
      if (r.status === 0 && r.stdout.trim()) return res.json({ path: r.stdout.trim() });
      return res.status(500).json({ error: r.stderr || 'Folder chooser cancelled or failed' });
    }
    // linux/unix: try zenity, then kdialog
    let r = spawnSync('zenity', ['--file-selection', '--directory', `--title=${prompt}`], { encoding: 'utf8' });
    if (r.status === 0 && r.stdout.trim()) return res.json({ path: r.stdout.trim() });
    r = spawnSync('kdialog', ['--getexistingdirectory', '$HOME'], { encoding: 'utf8' });
    if (r.status === 0 && r.stdout.trim()) return res.json({ path: r.stdout.trim() });
    return res.status(501).json({ error: 'Folder dialog not available on this system' });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || String(e) });
  }
});

app.get('/api/system/dialog-availability', (_req, res) => {
  const platform = process.platform;
  let available = false;
  if (platform === 'darwin' || platform === 'win32') available = true;
  else {
    const z = spawnSync('which', ['zenity']);
    const k = spawnSync('which', ['kdialog']);
    available = z.status === 0 || k.status === 0;
  }
  res.json({ platform, available });
});

// ---- List applied migrations on target (_prisma_migrations) ----
app.get('/api/prisma/applied-migrations', async (req, res) => {
  const target = String((req.query.target || 'direct')).toLowerCase();
  const rt = getRuntimeEnv();
  const map: any = {
    local: rt.LOCAL_DATABASE_URL,
    shadow: rt.SHADOW_DATABASE_URL,
    direct: rt.DIRECT_URL,
    pooled: rt.DATABASE_URL,
  };
  const url = map[target];
  if (!url) return res.status(400).json({ error: `URL for target '${target}' missing` });
  try {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    const { Client } = await import('pg');
    const client = new Client({ connectionString: url, ssl: url.includes('sslmode=require') ? { rejectUnauthorized: false } : undefined });
    await client.connect();
    const q = `select migration_name as name, finished_at from _prisma_migrations order by finished_at asc nulls last, migration_name asc`;
    const rs = await client.query(q);
    await client.end();
    const items = (rs.rows || []).map((r: any) => ({ name: String(r.name), finished_at: r.finished_at ? new Date(r.finished_at).toISOString() : null }));
    res.json({ target, total: items.length, items });
  } catch (e: any) {
    // Likely table missing or permission denied
    res.json({ target, total: 0, items: [], error: e?.message || String(e) });
  }
});

const port = Number(process.env.PORT || 6580);
app.listen(port, 'localhost', () => {
  // eslint-disable-next-line no-console
  console.log(`Server listening on http://localhost:${port}`);
});
