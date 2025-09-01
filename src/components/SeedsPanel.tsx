import { API_BASE } from '../config';
import React, { useEffect, useState } from 'react';

type ScriptsResponse = { cwd: string; scripts: Record<string, string> };

export default function SeedsPanel({ onTask }: { onTask: (taskId: string) => void }) {
  const [cwd, setCwd] = useState<string>('');
  const [scripts, setScripts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string>('');
  const [remember, setRemember] = useState<boolean>(true);
  const [canBrowse, setCanBrowse] = useState<boolean>(true);
  const [rootPath, setRootPath] = useState<string>('');
  const [rootValid, setRootValid] = useState<boolean>(false);

  async function loadScripts(dir?: string) {
    const r = await fetch(`${API_BASE}/api/scripts?cwd=${encodeURIComponent(dir || cwd || '')}`);
    const j = (await r.json()) as ScriptsResponse;
    setCwd(j.cwd);
    setScripts(j.scripts || {});
  }

  useEffect(() => {
    (async () => {
      try {
        const avail = await fetch(`${API_BASE}/api/system/dialog-availability`).then(r=>r.json()).catch(()=>({available:true}));
        setCanBrowse(!!avail.available);
        const r = await fetch(`${API_BASE}/api/settings`);
        const j = await r.json();
        if (j.PROJECT_ROOT) {
          setRootPath(j.PROJECT_ROOT);
          // validate
          try {
            const vr = await fetch(`${API_BASE}/api/system/validate-project?path=${encodeURIComponent(j.PROJECT_ROOT)}`);
            const vt = await vr.text();
            const vj = JSON.parse(vt);
            setRootValid(!!vj.ok);
            if (vj.ok) setCwd(j.PROJECT_ROOT);
          } catch {}
        }
        if (!j.PROJECT_ROOT && j.SEEDS_CWD) setCwd(j.SEEDS_CWD);
      } catch {}
      loadScripts();
    })();
  }, []);

  async function runScript(name: string) {
    setBusy(name);
    setMsg('');
    try {
      const r = await fetch(`${API_BASE}/api/scripts/run`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cwd, script: name }) });
      const j = await r.json();
      if (j.taskId) onTask(j.taskId);
    } finally { setBusy(null); }
  }

  async function runSeed(mode: 'npm-seed' | 'prisma-seed' | 'reset-and-seed') {
    setBusy(mode);
    setMsg('');
    try {
      const r = await fetch(`${API_BASE}/api/seeds/run`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cwd, mode }) });
      const j = await r.json();
      if (j.taskId) onTask(j.taskId);
    } finally { setBusy(null); }
  }

  function seedEntries() {
    return Object.entries(scripts)
      .filter(([name, cmd]) => name.toLowerCase().includes('seed') || /\bprisma\s+db\s+seed\b/.test(cmd))
      .sort(([a], [b]) => a.localeCompare(b));
  }

  return (
    <div className="bg-white dark:bg-gray-900 rounded border dark:border-gray-700 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <h2 className="text-lg font-semibold">Seeds & Scripts</h2>
        <button className="ml-auto px-3 py-1 rounded bg-gray-800 text-white" onClick={() => loadScripts()}>Refresh</button>
      </div>
      {!rootValid ? (
        <div className="flex gap-2 items-center">
          <input className="flex-1 border rounded px-3 py-1" value={cwd} onChange={(e) => setCwd(e.target.value)} placeholder="Path to project (where package.json lives)" />
          <button
            className="px-3 py-1 rounded bg-gray-200 dark:bg-gray-800 dark:text-gray-100 dark:border dark:border-gray-600 disabled:opacity-60"
            title="Pick folder via system dialog"
            disabled={!canBrowse}
            onClick={async () => {
              setMsg('');
              try {
                const r = await fetch(`${API_BASE}/api/system/choose-folder`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: 'Select project folder (contains package.json)' }) });
                const j = await r.json();
                if (r.ok && j.path) {
                  setCwd(j.path);
                } else {
                  setMsg(j.error || 'Folder dialog cancelled or not available. Enter the path manually.');
                }
              } catch (e: any) {
                setMsg(e?.message || 'Folder dialog failed. Enter the path manually.');
              }
            }}
          >Browse…</button>
          <button
            className="px-3 py-1 rounded bg-blue-600 text-white"
            title="Enter a folder path that contains package.json"
            onClick={async () => {
              if (remember) {
                try {
                  await fetch(`${API_BASE}/api/settings`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ SEEDS_CWD: cwd, SCRIPTS_CWD: cwd }) });
                } catch {}
              }
              loadScripts(cwd);
            }}
          >Load</button>
          <label className="text-sm flex items-center gap-2"><input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />Remember</label>
        </div>
      ) : (
        <div className="text-xs text-gray-600">Using Project Root: {rootPath}</div>
      )}
      <div className="space-y-2">
        <div className="font-medium">Quick seed actions</div>
        <div className="flex flex-wrap gap-2">
          <button className="px-2 py-1 rounded bg-indigo-600 text-white disabled:opacity-60" disabled={!!busy} onClick={() => runSeed('npm-seed')}>npm run seed</button>
          <button className="px-2 py-1 rounded bg-indigo-600 text-white disabled:opacity-60" disabled={!!busy} onClick={() => runSeed('prisma-seed')}>prisma db seed</button>
          <button className="px-2 py-1 rounded bg-red-600 text-white disabled:opacity-60" disabled={!!busy} onClick={() => runSeed('reset-and-seed')}>migrate reset + seed</button>
        </div>
        {seedEntries().length > 0 && (
          <div className="space-y-1">
            <div className="text-sm text-gray-700">Detected seed scripts</div>
            <div className="flex flex-wrap gap-2">
              {seedEntries().map(([name]) => (
                <button key={name} className="px-2 py-1 rounded bg-green-600 text-white disabled:opacity-60" disabled={!!busy} title={describeScript(name, scripts[name])} onClick={() => runScript(name)}>{name}</button>
              ))}
            </div>
          </div>
        )}
      </div>
      <div className="space-y-2">
        <div className="font-medium">Detected scripts</div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {Object.keys(scripts).length === 0 && <div className="text-sm text-gray-600">No scripts found in package.json</div>}
          {Object.entries(scripts).map(([name, cmd]) => (
            <div key={name} className="border rounded p-2 flex items-center gap-2">
              <div className="flex-1">
                <div className="font-mono text-xs">{name}</div>
                <div className="text-xs text-gray-600 truncate" title={cmd}>{cmd}</div>
              </div>
              <button className="px-2 py-1 rounded bg-gray-800 text-white disabled:opacity-60" disabled={!!busy} onClick={() => runScript(name)} title={describeScript(name, cmd)}>Run</button>
            </div>
          ))}
        </div>
      </div>
      {msg && <div className="text-sm text-red-700">{msg}</div>}
      <div className="text-xs text-gray-600">Tip: Configure Prisma seed in your project package.json: <code>{'{"prisma": {"seed": "tsx prisma/seed.ts"}}'}</code> or a "seed" script.</div>
    </div>
  );
}

function describeScript(name: string, cmd: string): string {
  const n = name.toLowerCase();
  if (n === 'seed') return 'Seeds the database with fixture data.';
  if (n.includes('dev')) return 'Starts the development server.';
  if (n.includes('build')) return 'Builds the project for production.';
  if (n.includes('start')) return 'Starts the production server.';
  if (n.includes('migrate')) return 'Database migration related task.';
  if (cmd.includes('prisma db seed')) return 'Runs Prisma seed hook.';
  if (cmd.includes('prisma migrate reset')) return 'Resets DB and re-applies migrations.';
  return cmd;
}
