import React, { useState } from 'react';
import { API_BASE } from '../config';

export default function BackupPanel() {
  const [outDir, setOutDir] = useState('backups');
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<{ ok?: boolean; file?: string; error?: string } | null>(null);

  async function run() {
    setRunning(true);
    setResult(null);
    try {
      const r = await fetch(`${API_BASE}/api/backup/pgdump`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ outDir }),
      });
      const j = await r.json();
      setResult(j);
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="bg-white dark:bg-gray-900 rounded border dark:border-gray-700 p-4 space-y-3">
      <h2 className="text-lg font-semibold">Backup (pg_dump)</h2>
      <div className="flex gap-2 items-center">
        <input className="border rounded px-3 py-1 flex-1" value={outDir} onChange={(e) => setOutDir(e.target.value)} placeholder="Output directory (created if missing)" />
        <button className="px-3 py-1 rounded bg-blue-600 text-white disabled:opacity-60" onClick={run} disabled={running}>{running ? 'Dumping…' : 'Run pg_dump'}</button>
      </div>
      {result && (
        <div className="text-sm">
          {result.ok ? (
            <div className="text-green-700">Dump saved: {result.file}</div>
          ) : (
            <div className="text-red-700">{result.error || 'Failed'}</div>
          )}
        </div>
      )}
      <div className="text-xs text-gray-600">Enable by setting PG_DUMP_PATH in .env or having pg_dump on PATH. Uses DIRECT_URL.</div>
    </div>
  );
}

