import React, { useEffect, useRef, useState } from 'react';
import { API_BASE } from '../config';

type LogEntry = { type: 'stdout' | 'stderr' | 'info'; message: string; ts: number };

export default function ConsolePanel({ taskId }: { taskId?: string }) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [done, setDone] = useState<number | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!taskId) return;
    setLogs([]);
    setDone(null);
    const es = new EventSource(`${API_BASE}/api/stream/${taskId}`);
    es.addEventListener('log', (e) => {
      try {
        const payload = JSON.parse((e as MessageEvent).data) as LogEntry;
        setLogs((prev) => [...prev, payload]);
      } catch {}
    });
    es.addEventListener('done', (e) => {
      const p = JSON.parse((e as MessageEvent).data);
      setDone(p.exitCode);
      es.close();
    });
    es.onerror = () => {
      // best-effort close
      es.close();
    };
    return () => es.close();
  }, [taskId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs.length, done]);

  const color = (t: LogEntry['type']) => (t === 'stderr' ? 'text-red-600' : t === 'stdout' ? 'text-gray-900' : 'text-blue-700');

  return (
    <div className="bg-black text-gray-100 rounded border border-gray-300 font-mono text-sm">
      <div className="p-2 border-b border-gray-700 flex items-center gap-2">
        <div className="text-gray-400">Console</div>
        <div className="ml-auto flex gap-2">
          <button
            className="px-2 py-0.5 rounded bg-gray-800 text-gray-200 disabled:opacity-60"
            disabled={!taskId}
            onClick={async () => {
              if (!taskId) return;
              const content = logs.map(l => `[${new Date(l.ts).toISOString()}] ${l.type.toUpperCase()}: ${l.message}`).join('');
              try { await navigator.clipboard.writeText(content); } catch {}
            }}
          >Copy</button>
          <button
            className="px-2 py-0.5 rounded bg-gray-800 text-gray-200 disabled:opacity-60"
            disabled={!taskId}
            onClick={async () => {
              if (!taskId) return;
              await fetch(`${API_BASE}/api/tasks/${taskId}/save-log`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ outDir: 'logs' }) });
            }}
          >Save</button>
        </div>
      </div>
      <div className="h-72 overflow-auto p-3">
        {taskId ? (
          <>
            {logs.map((l, i) => (
              <div key={i} className={color(l.type)}>
                <span className="text-gray-500">[{new Date(l.ts).toLocaleTimeString()}]</span> {l.message}
              </div>
            ))}
            {done !== null && (
              <div className="text-gray-300">[process exited with code {done}]</div>
            )}
            <div ref={bottomRef} />
          </>
        ) : (
          <div className="text-gray-400">Run a command to see logs…</div>
        )}
      </div>
    </div>
  );
}
