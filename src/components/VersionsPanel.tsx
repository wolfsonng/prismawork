import { API_BASE } from '../config';
import React, { useEffect, useState } from 'react';

type Versions = {
  node: string;
  prisma: string;
  postgres: { local: string | null; direct: string | null; localMajor: string | null; directMajor: string | null };
};

export default function VersionsPanel() {
  const [data, setData] = useState<Versions | null>(null);
  const [extLocal, setExtLocal] = useState<string[] | null>(null);
  const [extDirect, setExtDirect] = useState<string[] | null>(null);

  useEffect(() => {
    (async () => {
      const r = await fetch(`${API_BASE}/api/system/versions`);
      setData(await r.json());
      const el = await fetch(`${API_BASE}/api/system/extensions?target=local`).then((r) => r.json());
      if (el.ok) setExtLocal(el.extensions);
      const ed = await fetch(`${API_BASE}/api/system/extensions?target=direct`).then((r) => r.json());
      if (ed.ok) setExtDirect(ed.extensions);
    })();
  }, []);

  const need = ['pgcrypto', 'uuid-ossp'];
  const missing = (list: string[] | null) => need.filter((n) => !list?.includes(n));

  return (
    <div className="bg-white dark:bg-gray-900 rounded border dark:border-gray-700 p-4 space-y-3">
      <h2 className="text-lg font-semibold">System Versions</h2>
      {data ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div className="space-y-1">
            <div><span className="font-medium">Node:</span> {data.node}</div>
            <div><span className="font-medium">Prisma:</span> <pre className="inline whitespace-pre-wrap">{data.prisma}</pre></div>
          </div>
          <div className="space-y-1">
            <div><span className="font-medium">Postgres (local):</span> {data.postgres.local || '—'} {data.postgres.localMajor && <span className="text-gray-500">(v{data.postgres.localMajor})</span>}</div>
            <div><span className="font-medium">Postgres (direct):</span> {data.postgres.direct || '—'} {data.postgres.directMajor && <span className="text-gray-500">(v{data.postgres.directMajor})</span>}</div>
          </div>
        </div>
      ) : (
        <div className="text-sm text-gray-600">Loading…</div>
      )}

      <div className="text-sm space-y-2">
        <div className="font-medium">Extensions check</div>
        <div className="flex flex-wrap gap-2 items-center">
          <span>Local:</span>
          {extLocal ? (
            missing(extLocal).length === 0 ? (
              <span className="px-2 py-0.5 rounded text-xs bg-green-100 text-green-800">ok</span>
            ) : (
              missing(extLocal).map((m) => (
                <span key={m} className="px-2 py-0.5 rounded text-xs bg-yellow-100 text-yellow-800">{m} missing</span>
              ))
            )
          ) : (
            <span className="text-gray-500">—</span>
          )}
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <span>Direct:</span>
          {extDirect ? (
            missing(extDirect).length === 0 ? (
              <span className="px-2 py-0.5 rounded text-xs bg-green-100 text-green-800">ok</span>
            ) : (
              missing(extDirect).map((m) => (
                <span key={m} className="px-2 py-0.5 rounded text-xs bg-yellow-100 text-yellow-800">{m} missing</span>
              ))
            )
          ) : (
            <span className="text-gray-500">—</span>
          )}
        </div>
        <div className="text-xs text-gray-600">
          If missing locally, you can enable with: <code>CREATE EXTENSION IF NOT EXISTS "pgcrypto";</code> and <code>CREATE EXTENSION IF NOT EXISTS "uuid-ossp";</code>
        </div>
      </div>
    </div>
  );
}

