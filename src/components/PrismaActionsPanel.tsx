import React, { useState } from 'react';
import { API_BASE } from '../config';

async function post(path: string) {
  const r = await fetch(`${API_BASE}${path}`, { method: 'POST' });
  if (!r.ok) throw new Error('Request failed');
  return r.json() as Promise<{ taskId: string }>; 
}

async function get(path: string) {
  const r = await fetch(`${API_BASE}${path}`);
  if (!r.ok) throw new Error('Request failed');
  return r.json() as Promise<{ taskId: string }>; 
}

export default function PrismaActionsPanel({ onTask }: { onTask: (taskId: string) => void }) {
  const [busy, setBusy] = useState<string | null>(null);

  async function run(name: string, fn: () => Promise<{ taskId: string }>) {
    setBusy(name);
    try {
      const { taskId } = await fn();
      onTask(taskId);
    } finally {
      setBusy(null);
    }
  }

  const items: { key: string; label: string; title: string; fn: () => Promise<{ taskId: string }>; stage: number }[] = [
    { key: 'format', label: '1) format', title: 'Format schema.prisma', fn: () => post('/api/prisma/format'), stage: 1 },
    { key: 'generate', label: '2) generate', title: 'Generate Prisma Client', fn: () => post('/api/prisma/generate'), stage: 2 },
    { key: 'migrate-dev', label: '3) migrate dev', title: 'Create/apply local migration (LOCAL + SHADOW)', fn: () => post('/api/prisma/migrate-dev'), stage: 3 },
    { key: 'status', label: '4) status', title: 'Show pending/applied migration status (DIRECT)', fn: () => get('/api/prisma/status'), stage: 4 },
    { key: 'diff', label: '5) diff', title: 'Preview SQL diff against DIRECT_URL', fn: () => post('/api/prisma/diff'), stage: 5 },
    { key: 'migrate-deploy', label: '6) deploy', title: 'Apply migrations to DIRECT_URL (Supabase)', fn: () => post('/api/prisma/migrate-deploy'), stage: 6 },
    { key: 'db-pull', label: 'db pull', title: 'Introspect DIRECT_URL into schema.prisma', fn: () => post('/api/prisma/db-pull'), stage: 0 },
  ];

  return (
    <div className="bg-white dark:bg-gray-900 rounded border dark:border-gray-700 p-4 space-y-3">
      <h2 className="text-lg font-semibold">Prisma Actions</h2>
      <div className="flex flex-wrap gap-2">
        {items.sort((a,b) => a.stage - b.stage).map((it) => (
          <button key={it.key} className="px-3 py-1 rounded bg-indigo-600 text-white disabled:opacity-60" disabled={busy!==null} title={it.title} onClick={() => run(it.key, it.fn)}>{it.label}</button>
        ))}
      </div>
    </div>
  );
}
