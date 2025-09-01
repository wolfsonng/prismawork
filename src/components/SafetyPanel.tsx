import { API_BASE } from '../config';
import React, { useState } from 'react';

type CheckResult = {
  connections: {
    local: any; shadow: any; direct: any; pooled: any;
  };
  git: { clean: boolean; error?: string };
  prismaStatus: { code: number | null; stdout: string; stderr: string };
};

export default function SafetyPanel() {
  const [result, setResult] = useState<CheckResult | null>(null);
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    try {
      const r = await fetch(`${API_BASE}/api/safety/predeploy-check`, { method: 'POST' });
      setResult(await r.json());
    } finally {
      setBusy(false);
    }
  }

  const Badge = ({ ok, label }: { ok: boolean; label: string }) => (
    <span className={`px-2 py-0.5 rounded text-xs ${ok ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-700'}`}>{label}</span>
  );

  return (
    <div className="bg-white dark:bg-gray-900 rounded border dark:border-gray-700 p-4 space-y-3">
      <div className="flex items-center gap-3">
        <h2 className="text-lg font-semibold">Pre-Deploy Checklist</h2>
        <button className="ml-auto px-3 py-1 rounded bg-blue-600 text-white disabled:opacity-60" disabled={busy} onClick={run}>{busy ? 'Running…' : 'Run checks'}</button>
      </div>
      {result && (
        <div className="space-y-3 text-sm">
          <div className="flex flex-wrap gap-2 items-center">
            <span>Connections:</span>
            <Badge ok={!!result.connections.local.ok} label={`Local (${result.connections.local.ok ? result.connections.local.latencyMs+'ms' : 'fail'})`} />
            <Badge ok={!!result.connections.shadow.ok} label={`Shadow (${result.connections.shadow.ok ? result.connections.shadow.latencyMs+'ms' : 'fail'})`} />
            <Badge ok={!!result.connections.direct.ok} label={`Direct (${result.connections.direct.ok ? result.connections.direct.latencyMs+'ms' : 'fail'})`} />
            <Badge ok={!!result.connections.pooled.ok} label={`Pooled (${result.connections.pooled.ok ? result.connections.pooled.latencyMs+'ms' : 'fail'})`} />
          </div>
          <div className="flex gap-2 items-center">
            <span>Git status:</span>
            <Badge ok={result.git.clean} label={result.git.clean ? 'clean' : 'dirty'} />
            {!result.git.clean && result.git.error && <span className="text-red-700">{result.git.error}</span>}
          </div>
          <div>
            <div className="font-medium">Pending migrations (prisma migrate status):</div>
            <pre className="mt-1 bg-gray-100 rounded p-2 whitespace-pre-wrap text-xs max-h-48 overflow-auto">{result.prismaStatus.stdout || result.prismaStatus.stderr}</pre>
          </div>
        </div>
      )}
    </div>
  );
}

