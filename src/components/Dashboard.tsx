import { API_BASE } from '../config';
import React, { useEffect, useState } from 'react';
import type { EnvState } from '../api';
import { fetchEnvState, fetchMigrations, testConnection } from '../api';

export default function Dashboard({ onTask }: { onTask: (taskId: string) => void }) {
  const [env, setEnv] = useState<EnvState | null>(null);
  const [migs, setMigs] = useState<{ total: number; items: { name: string; label: string; dir: string; ts: string }[] } | null>(null);
  const [testing, setTesting] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    fetchEnvState().then(setEnv);
    fetchMigrations().then(setMigs);
  }, []);

  async function quickTest() {
    if (!env) return;
    const p = env.profiles[env.ACTIVE_PROFILE];
    const map: [string, string | undefined][] = [
      ['Local', p.LOCAL_DATABASE_URL],
      ['Shadow', p.SHADOW_DATABASE_URL],
      ['Direct', p.DIRECT_URL],
      ['Pooled', p.DATABASE_URL],
    ];
    for (const [k, url] of map) {
      if (!url) { setTesting((t) => ({ ...t, [k]: '—' })); continue; }
      setTesting((t) => ({ ...t, [k]: '…' }));
      const res = await testConnection(url);
      setTesting((t) => ({ ...t, [k]: res.ok ? `${res.latencyMs}ms` : 'fail' }));
    }
  }

  async function run(path: string, method: 'POST' | 'GET' = 'POST') {
    setBusy(path);
    try {
      const r = await fetch(`${API_BASE}${path}`, { method });
      const j = await r.json();
      if (j?.taskId) onTask(j.taskId);
    } finally {
      setBusy(null);
    }
  }

  const latest = migs?.items?.[migs.items.length - 1];

  return (
    <div className="bg-white dark:bg-gray-900 rounded border dark:border-gray-700 p-4 space-y-4">
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-semibold">Dashboard</h1>
        {env && (
          <span className="px-2 py-0.5 rounded text-xs bg-gray-100 border">Active: {env.ACTIVE_PROFILE}</span>
        )}
        <button className="ml-auto px-3 py-1 rounded bg-gray-800 text-white" onClick={() => { fetchEnvState().then(setEnv); fetchMigrations().then(setMigs); }}>Refresh</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="border rounded p-3 space-y-2">
          <div className="font-medium">Connections</div>
          <div className="flex flex-wrap gap-2 items-center text-sm">
            {['Local', 'Shadow', 'Direct', 'Pooled'].map((k) => (
              <span key={k} className={`px-2 py-0.5 rounded text-xs ${testing[k] && testing[k]!== 'fail' ? 'bg-green-100 text-green-800' : testing[k] === 'fail' ? 'bg-red-100 text-red-700' : 'bg-gray-100'}`}>{k}: {testing[k] || '—'}</span>
            ))}
            <button className="ml-auto px-2 py-0.5 rounded bg-blue-600 text-white" onClick={quickTest}>Test</button>
          </div>
        </div>

        <div className="border rounded p-3 space-y-1">
          <div className="font-medium">Migrations</div>
          <div className="text-sm">Total: {migs?.total ?? '—'}</div>
          <div className="text-sm">Latest: {latest ? `${latest.name} (${new Date(latest.ts).toLocaleString()})` : '—'}</div>
        </div>

        <div className="border rounded p-3 space-y-2">
          <div className="font-medium">Quick Actions</div>
          <div className="flex flex-wrap gap-2">
            <button className="px-2 py-1 rounded bg-indigo-600 text-white disabled:opacity-60" disabled={!!busy} onClick={() => run('/api/prisma/migrate-dev')}>migrate dev</button>
            <button className="px-2 py-1 rounded bg-indigo-600 text-white disabled:opacity-60" disabled={!!busy} onClick={() => run('/api/prisma/diff')}>diff</button>
            <button className="px-2 py-1 rounded bg-red-600 text-white disabled:opacity-60" disabled={!!busy} onClick={() => run('/api/prisma/migrate-deploy')}>deploy</button>
          </div>
        </div>
      </div>
    </div>
  );
}

