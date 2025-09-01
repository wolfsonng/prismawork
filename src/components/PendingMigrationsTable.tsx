import React, { useEffect, useMemo, useState } from 'react';
import { fetchAppliedMigrations, fetchMigrations } from '../api';

type LocalMig = { name: string; label: string; dir: string; ts: string };
type Applied = { name: string; finished_at: string | null };

export default function PendingMigrationsTable() {
  const [local, setLocal] = useState<LocalMig[]>([]);
  const [applied, setApplied] = useState<Applied[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const lm = await fetchMigrations();
      setLocal(lm.items);
      const am = await fetchAppliedMigrations('direct');
      setApplied(am.items);
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const appliedSet = useMemo(() => new Set(applied.map((a) => a.name)), [applied]);
  const rows = useMemo(() => local.map((m) => ({
    ...m,
    applied: appliedSet.has(m.name),
    finishedAt: applied.find((a) => a.name === m.name)?.finished_at || null,
  })), [local, applied, appliedSet]);

  const pendingCount = rows.filter((r) => !r.applied).length;

  return (
    <div className="bg-white dark:bg-gray-900 rounded border dark:border-gray-700 p-4 space-y-3">
      <div className="flex items-center gap-3">
        <h2 className="text-lg font-semibold">Pending Migrations</h2>
        <span className={`px-2 py-0.5 rounded text-xs ${pendingCount === 0 ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>{pendingCount === 0 ? 'up-to-date' : `${pendingCount} pending`}</span>
        <button className="ml-auto px-3 py-1 rounded bg-gray-800 text-white" onClick={load} disabled={loading}>{loading ? 'Refreshing…' : 'Refresh'}</button>
      </div>
      {error && <div className="text-sm text-red-700">{error}</div>}
      <div className="overflow-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-left border-b">
              <th className="py-2 pr-4">Name</th>
              <th className="py-2 pr-4">Local Timestamp</th>
              <th className="py-2 pr-4">Applied</th>
              <th className="py-2 pr-4">Applied At</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.name} className="border-b">
                <td className="py-1 pr-4 font-mono">{r.name}</td>
                <td className="py-1 pr-4">{new Date(r.ts).toLocaleString()}</td>
                <td className="py-1 pr-4">{r.applied ? <span className="px-2 py-0.5 rounded text-xs bg-green-100 text-green-800">yes</span> : <span className="px-2 py-0.5 rounded text-xs bg-yellow-100 text-yellow-800">no</span>}</td>
                <td className="py-1 pr-4">{r.finishedAt ? new Date(r.finishedAt).toLocaleString() : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

