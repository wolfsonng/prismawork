import { API_BASE } from '../config';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { fetchEnvState } from '../api';

function lcsDiff(a: string[], b: string[]) {
  const n = a.length, m = b.length;
  const dp = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const res: { type: 'eq' | 'add' | 'del'; left?: string; right?: string }[] = [];
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) { res.push({ type: 'eq', left: a[i], right: b[j] }); i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) { res.push({ type: 'del', left: a[i++] }); }
    else { res.push({ type: 'add', right: b[j++] }); }
  }
  while (i < n) res.push({ type: 'del', left: a[i++] });
  while (j < m) res.push({ type: 'add', right: b[j++] });
  return res;
}

async function readFile(path: string) {
  const r = await fetch(`${API_BASE}/api/files/read`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path }) });
  if (!r.ok) throw new Error('Failed to read file');
  return (await r.json()) as { path: string; content: string };
}

export default function SchemaFileDiff() {
  const [leftPath, setLeftPath] = useState('');
  const [rightPath, setRightPath] = useState('');
  const [left, setLeft] = useState('');
  const [right, setRight] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [env, setEnv] = useState<any>(null);
  const [pullUrl, setPullUrl] = useState<string>('');
  const changeRefs = useRef<HTMLDivElement[]>([]);
  const [changeIdx, setChangeIdx] = useState<number>(-1);

  useEffect(() => {
    (async () => {
      try {
        fetchEnvState().then((e) => {
          setEnv(e);
          const p = e.profiles[e.ACTIVE_PROFILE];
          setPullUrl(p.DIRECT_URL || p.DATABASE_URL || p.LOCAL_DATABASE_URL || '');
        }).catch(()=>{});
        const r = await fetch(`${API_BASE}/api/settings`);
        const j = await r.json();
        const base = j.SCRIPTS_CWD || j.SEEDS_CWD || '';
        if (base) setLeftPath(`${base.replace(/\/$/, '')}/prisma/schema.prisma`);
      } catch {}
    })();
  }, []);

  async function browse(which: 'left' | 'right') {
    setMsg('');
    try {
      const r = await fetch(`${API_BASE}/api/system/choose-file`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: 'Select schema.prisma' }) });
      const j = await r.json();
      if (r.ok && j.path) {
        if (which === 'left') setLeftPath(j.path); else setRightPath(j.path);
      } else setMsg(j.error || 'File dialog cancelled');
    } catch (e: any) { setMsg(e?.message || 'File dialog failed'); }
  }

  async function loadAndDiff() {
    setBusy(true); setMsg('');
    try {
      const [L, R] = await Promise.all([readFile(leftPath), readFile(rightPath)]);
      setLeft(L.content); setRight(R.content);
    } catch (e: any) { setMsg(e?.message || String(e)); }
    finally { setBusy(false); }
  }

  function deriveCwd(p: string) {
    if (!p) return '';
    const norm = p.replace(/\\/g, '/');
    const needle = '/prisma/schema.prisma';
    const idx = norm.lastIndexOf(needle);
    return idx >= 0 ? norm.substring(0, idx) : '';
  }

  async function pullToRight() {
    setBusy(true); setMsg('');
    try {
      const body = { url: pullUrl, cwd: deriveCwd(leftPath) || undefined };
      const r = await fetch(`${API_BASE}/api/prisma/db-pull-print`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const text = await r.text();
      let j: any = {};
      try { j = JSON.parse(text); } catch { setMsg('Server returned non-JSON response'); return; }
      if (r.ok && j.path) { setRightPath(j.path); await loadAndDiff(); } else setMsg(j.error || 'db pull failed');
    } catch (e: any) { setMsg(e?.message || 'db pull failed'); }
    finally { setBusy(false); }
  }

  const diffs = useMemo(() => lcsDiff(left.split(/\r?\n/), right.split(/\r?\n/)), [left, right]);

  useEffect(() => {
    changeRefs.current = [];
  }, [diffs]);

  function goToChange(dir: 1 | -1) {
    const indices = diffs.map((d, i) => ({ d, i })).filter(x => x.d.type !== 'eq').map(x => x.i);
    if (indices.length === 0) return;
    let nextIdx = 0;
    if (changeIdx === -1) nextIdx = indices[0];
    else {
      const pos = indices.findIndex((i) => i === changeIdx);
      nextIdx = indices[(pos + (dir === 1 ? 1 : indices.length - 1)) % indices.length];
    }
    setChangeIdx(nextIdx);
    const el = changeRefs.current[nextIdx];
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  const rows = lcsDiff(left.split(/\r?\n/), right.split(/\r?\n/));

  return (
    <div className="bg-white dark:bg-gray-900 rounded border dark:border-gray-700 p-4 space-y-3">
      <h2 className="text-lg font-semibold">Schema File Diff (side‑by‑side)</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 items-center">
        <div className="flex gap-2 items-center">
          <input className="flex-1 border rounded px-3 py-1" value={leftPath} onChange={(e)=>setLeftPath(e.target.value)} placeholder="Left schema.prisma path" />
          <button className="px-2 py-1 rounded bg-gray-200 dark:bg-gray-800 dark:text-gray-100 dark:border dark:border-gray-600" onClick={()=>browse('left')}>Browse…</button>
          <button className="px-2 py-1 rounded bg-gray-200 dark:bg-gray-800 dark:text-gray-100 dark:border dark:border-gray-600" title="Use current project's prisma/schema.prisma" onClick={() => {
            if (env) {
              fetch(`${API_BASE}/api/settings`).then(r=>r.json()).then(j => {
                const base = j.SCRIPTS_CWD || j.SEEDS_CWD || '';
                if (base) setLeftPath(`${base.replace(/\/$/, '')}/prisma/schema.prisma`);
              }).catch(()=>{});
            }
          }}>Use Project Schema</button>
        </div>
        <div className="flex gap-2 items-center">
          <input className="flex-1 border rounded px-3 py-1" value={rightPath} onChange={(e)=>setRightPath(e.target.value)} placeholder="Right schema.prisma path" />
          <button className="px-2 py-1 rounded bg-gray-200 dark:bg-gray-800 dark:text-gray-100 dark:border dark:border-gray-600" onClick={()=>browse('right')}>Browse…</button>
        </div>
      </div>
      <div className="flex items-center gap-2 text-sm">
        <span>Pull to Right from</span>
        <select className="border rounded px-2 py-1" value={pullUrl} onChange={(e)=>setPullUrl(e.target.value)}>
          <option value="">Select URL…</option>
          {env && (()=>{ const p=env.profiles[env.ACTIVE_PROFILE]; return [
            p.DIRECT_URL? <option key="direct" value={p.DIRECT_URL}>DIRECT_URL</option> : null,
            p.DATABASE_URL? <option key="pooled" value={p.DATABASE_URL}>DATABASE_URL</option> : null,
            p.LOCAL_DATABASE_URL? <option key="local" value={p.LOCAL_DATABASE_URL}>LOCAL_DATABASE_URL</option> : null,
          ]; })()}
        </select>
        <button className="px-2 py-1 rounded bg-green-600 text-white disabled:opacity-60" disabled={busy || !pullUrl} onClick={pullToRight}>Pull → Right</button>
        <div className="ml-auto flex gap-2">
          <button className="px-2 py-1 rounded bg-gray-200 dark:bg-gray-800 dark:text-gray-100 dark:border dark:border-gray-600" onClick={()=>goToChange(-1)}>Prev change</button>
          <button className="px-2 py-1 rounded bg-gray-200 dark:bg-gray-800 dark:text-gray-100 dark:border dark:border-gray-600" onClick={()=>goToChange(1)}>Next change</button>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button className="px-3 py-1 rounded bg-blue-600 text-white disabled:opacity-60" disabled={busy || !leftPath || !rightPath} onClick={loadAndDiff}>{busy? 'Loading…':'Load & Diff'}</button>
        {msg && <div className="text-sm text-red-700">{msg}</div>}
      </div>
      <div className="grid grid-cols-2 gap-2 text-sm font-mono">
        <div className="border rounded overflow-auto max-h-96">
          {diffs.map((r, i) => (
            <div key={i} ref={(el)=>{ if (el) changeRefs.current[i]=el; }} className={`${r.type==='add'?'bg-green-50': r.type==='del'?'bg-red-50':'bg-white'} px-2 whitespace-pre flex`}> 
              <div className="w-10 text-right pr-2 text-gray-400">{r.left!==undefined ? i+1 : ''}</div>
              <div className="flex-1">{(r.left ?? '')}</div>
            </div>
          ))}
        </div>
        <div className="border rounded overflow-auto max-h-96">
          {diffs.map((r, i) => (
            <div key={i} className={`${r.type==='add'?'bg-green-50': r.type==='del'?'bg-red-50':'bg-white'} px-2 whitespace-pre flex`}> 
              <div className="w-10 text-right pr-2 text-gray-400">{r.right!==undefined ? i+1 : ''}</div>
              <div className="flex-1">{(r.right ?? '')}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="text-xs text-gray-600">Green = added on right; Red = removed from left; white = unchanged.</div>
    </div>
  );
}
