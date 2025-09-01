import { API_BASE } from '../config';
import React, { useEffect, useState } from 'react';

export default function StudioPanel() {
  const [status, setStatus] = useState<{ running: boolean; port?: number; url?: string } | null>(null);
  const [port, setPort] = useState<number>(5555);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [use, setUse] = useState<'local'|'direct'|'pooled'>('local');

  async function refresh() {
    try {
      const r = await fetch(`${API_BASE}/api/prisma/studio/status`);
      setStatus(await r.json());
      // load per-project defaults
      try {
        const cur = await fetch(`${API_BASE}/api/projects/current`).then(res=>res.json());
        if (cur?.data) {
          if (typeof cur.data.studioPort === 'number') setPort(cur.data.studioPort);
          if (cur.data.studioUse === 'local' || cur.data.studioUse === 'direct' || cur.data.studioUse === 'pooled') setUse(cur.data.studioUse);
        }
      } catch {}
    } catch {}
  }

  useEffect(() => { refresh(); }, []);

  async function start() {
    setBusy(true); setMsg('');
    try {
      const r = await fetch(`${API_BASE}/api/prisma/studio/start`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ port, use }) });
      const j = await r.json();
      if (j.ok) { setStatus({ running: true, port: j.port, url: j.url }); }
      else setMsg('Failed to start');
      // persist defaults per project
      try {
        const cur = await fetch(`${API_BASE}/api/projects/current`).then(res=>res.json());
        if (cur?.root) {
          await fetch(`${API_BASE}/api/projects/update`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ root: cur.root, data: { studioPort: port, studioUse: use } }) });
        }
      } catch {}
    } catch (e: any) { setMsg(e?.message || 'Failed to start'); }
    finally { setBusy(false); }
  }

  async function stop() {
    setBusy(true); setMsg('');
    try {
      const r = await fetch(`${API_BASE}/api/prisma/studio/stop`, { method: 'POST' });
      const j = await r.json();
      if (j.ok) { setStatus({ running: false }); }
    } catch (e: any) { setMsg(e?.message || 'Failed to stop'); }
    finally { setBusy(false); }
  }

  return (
    <div className="bg-white dark:bg-gray-900 rounded border dark:border-gray-700 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <h2 className="text-lg font-semibold">Prisma Studio</h2>
        <button className="ml-auto px-2 py-1 rounded bg-gray-200 dark:bg-gray-800 dark:text-gray-100 dark:border dark:border-gray-600" onClick={refresh}>Refresh</button>
      </div>
      <div className="flex items-center gap-2 text-sm">
        <label className="flex items-center gap-2">Port <input className="border rounded px-2 py-1 w-24" type="number" value={port} onChange={(e)=>setPort(Number(e.target.value)||5555)} /></label>
        <label className="flex items-center gap-2">Use
          <select className="border rounded px-2 py-1" value={use} onChange={(e)=>setUse(e.target.value as any)}>
            <option value="local">LOCAL_DATABASE_URL</option>
            <option value="direct">DIRECT_URL</option>
            <option value="pooled">DATABASE_URL</option>
          </select>
        </label>
        {status?.running ? (
          <>
            <a className="px-3 py-1 rounded bg-green-600 text-white" href={status.url} target="_blank" rel="noreferrer">Open Studio</a>
            <button className="px-3 py-1 rounded bg-red-600 text-white disabled:opacity-60" onClick={stop} disabled={busy}>Stop</button>
          </>
        ) : (
          <button className="px-3 py-1 rounded bg-blue-600 text-white disabled:opacity-60" onClick={start} disabled={busy}>Start Studio</button>
        )}
      </div>
      {msg && <div className="text-xs text-red-700">{msg}</div>}
      <div className="text-xs text-gray-600">Runs in PROJECT_ROOT; opens at http://localhost:port</div>
    </div>
  );
}
