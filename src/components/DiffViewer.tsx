import { API_BASE } from '../config';
import React, { useEffect, useState } from 'react';
import { diffPreview, fetchEnvState } from '../api';

export default function DiffViewer() {
  const [sql, setSql] = useState<string>('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [env, setEnv] = useState<any>(null);
  const [fromKind, setFromKind] = useState<'url'|'schema'|'migrations'>('url');
  const [toKind, setToKind] = useState<'url'|'schema'|'migrations'>('schema');
  const [fromVal, setFromVal] = useState<string>('');
  const [toVal, setToVal] = useState<string>('prisma/schema.prisma');
  const [cwd, setCwd] = useState<string>('');
  const [remember, setRemember] = useState<boolean>(true);
  const [msg, setMsg] = useState<string>('');
  const [rootValid, setRootValid] = useState<boolean>(false);
  const [rootPath, setRootPath] = useState<string>('');

  useEffect(() => { fetchEnvState().then(setEnv).catch(()=>{}); }, []);
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`${API_BASE}/api/settings`);
        const j = await r.json();
        if (j.PROJECT_ROOT) {
          setRootPath(j.PROJECT_ROOT);
          try {
            const vr = await fetch(`${API_BASE}/api/system/validate-project?path=${encodeURIComponent(j.PROJECT_ROOT)}`);
            const vt = await vr.text();
            const vj = JSON.parse(vt);
            setRootValid(!!vj.ok);
            if (vj.ok) setCwd(j.PROJECT_ROOT);
          } catch {}
        }
        if (!j.PROJECT_ROOT && j.SCRIPTS_CWD) setCwd(j.SCRIPTS_CWD);
        else if (!j.PROJECT_ROOT && j.SEEDS_CWD) setCwd(j.SEEDS_CWD);
      } catch {}
    })();
  }, []);

  useEffect(() => {
    if (!env) return;
    const p = env.profiles[env.ACTIVE_PROFILE];
    setFromVal(p.DIRECT_URL || p.DATABASE_URL || '');
  }, [env]);

  async function load() {
    setBusy(true);
    setErr(null);
    try {
      if (remember && cwd) {
        try { await fetch(`${API_BASE}/api/settings`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ SCRIPTS_CWD: cwd }) }); } catch {}
      }
      const res = await diffPreview(
        { kind: fromKind, value: fromKind==='url'?fromVal: fromKind==='schema'? (toVal || 'prisma/schema.prisma') : 'prisma/migrations' },
        { kind: toKind, value: toKind==='url'?toVal: toKind==='schema'? (toVal || 'prisma/schema.prisma') : 'prisma/migrations' },
        { cwd }
      );
      setSql(res.sql);
    } catch (e: any) {
      setErr(e?.message || String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="bg-white dark:bg-gray-900 rounded border dark:border-gray-700 p-4 space-y-3">
      <div className="flex items-center gap-3 flex-wrap">
        <h2 className="text-lg font-semibold">Schema Diff (SQL Preview)</h2>
        <div className="flex items-center gap-2 text-sm">
          <span>From</span>
          <select className="border rounded px-2 py-1" value={fromKind} onChange={(e)=>setFromKind(e.target.value as any)}>
            <option value="url">URL</option>
            <option value="schema">Schema</option>
            <option value="migrations">Migrations</option>
          </select>
          {fromKind==='url' ? (
            <select className="border rounded px-2 py-1" value={fromVal} onChange={(e)=>setFromVal(e.target.value)}>
              <option value="">Select URL…</option>
              {env && (()=>{ const p=env.profiles[env.ACTIVE_PROFILE]; return [
                p.LOCAL_DATABASE_URL? <option key="local" value={p.LOCAL_DATABASE_URL}>LOCAL_DATABASE_URL</option> : null,
                p.DIRECT_URL? <option key="direct" value={p.DIRECT_URL}>DIRECT_URL</option> : null,
                p.DATABASE_URL? <option key="pooled" value={p.DATABASE_URL}>DATABASE_URL</option> : null,
              ]; })()}
            </select>
          ) : fromKind==='schema' ? (
            <input className="border rounded px-2 py-1" value={toVal} onChange={(e)=>setToVal(e.target.value)} placeholder="prisma/schema.prisma" />
          ) : (
            <input className="border rounded px-2 py-1" value={'prisma/migrations'} readOnly />
          )}
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span>To</span>
          <select className="border rounded px-2 py-1" value={toKind} onChange={(e)=>setToKind(e.target.value as any)}>
            <option value="schema">Schema</option>
            <option value="url">URL</option>
            <option value="migrations">Migrations</option>
          </select>
          {toKind==='url' ? (
            <select className="border rounded px-2 py-1" value={toVal} onChange={(e)=>setToVal(e.target.value)}>
              <option value="">Select URL…</option>
              {env && (()=>{ const p=env.profiles[env.ACTIVE_PROFILE]; return [
                p.LOCAL_DATABASE_URL? <option key="local2" value={p.LOCAL_DATABASE_URL}>LOCAL_DATABASE_URL</option> : null,
                p.DIRECT_URL? <option key="direct2" value={p.DIRECT_URL}>DIRECT_URL</option> : null,
                p.DATABASE_URL? <option key="pooled2" value={p.DATABASE_URL}>DATABASE_URL</option> : null,
              ]; })()}
            </select>
          ) : toKind==='schema' ? (
            <input className="border rounded px-2 py-1" value={toVal} onChange={(e)=>setToVal(e.target.value)} placeholder="prisma/schema.prisma" />
          ) : (
            <input className="border rounded px-2 py-1" value={'prisma/migrations'} readOnly />
          )}
        </div>
        <button className="ml-auto px-3 py-1 rounded bg-blue-600 text-white disabled:opacity-60" onClick={load} disabled={busy || (fromKind==='url' && !fromVal) || (toKind==='url' && !toVal)}>{busy ? 'Loading…' : 'Run Diff'}</button>
        <button
          className="px-3 py-1 rounded bg-gray-700 text-white disabled:opacity-60 dark:bg-gray-800"
          onClick={async () => { try { await navigator.clipboard.writeText(sql); } catch {} }}
          disabled={!sql}
        >Copy</button>
      </div>
      {!rootValid ? (
        <div className="flex items-center gap-2">
          <input className="border rounded px-3 py-1 flex-1" value={cwd} onChange={(e)=>setCwd(e.target.value)} placeholder="Working directory (project with prisma/)" />
        <button
          className="px-3 py-1 rounded bg-gray-200 dark:bg-gray-800 dark:text-gray-100 dark:border dark:border-gray-600"
          onClick={async () => {
              setMsg('');
              try {
                const r = await fetch(`${API_BASE}/api/system/choose-folder`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: 'Select project folder (contains prisma/)' }) });
                const j = await r.json();
                if (r.ok && j.path) setCwd(j.path); else setMsg(j.error || 'Folder dialog cancelled');
              } catch (e: any) { setMsg(e?.message || 'Folder dialog failed'); }
            }}
          >Browse…</button>
          <label className="text-sm flex items-center gap-2"><input type="checkbox" checked={remember} onChange={(e)=>setRemember(e.target.checked)} />Remember</label>
        </div>
      ) : (
        <div className="text-xs text-gray-600">Using Project Root: {rootPath}</div>
      )}
      {msg && <div className="text-xs text-red-700">{msg}</div>}
      <div className="text-xs text-gray-600">
        Tip: Compare a database URL to your local schema to preview what deploy would do. Other useful combos:
        From URL → To Migrations (check drift); From Migrations → To URL (see what applying your folder would change on target).
      </div>
      {err && <div className="text-sm text-red-700">{err}</div>}
      <pre className="bg-black text-green-200 rounded p-3 text-xs overflow-auto max-h-80 whitespace-pre-wrap">{sql || 'Run Refresh to view the SQL plan.'}</pre>
    </div>
  );
}
