import { API_BASE } from '../config';
import React, { useEffect, useState } from 'react';

export default function RootBanner({ onChange }: { onChange?: () => void }) {
  const [root, setRoot] = useState('');
  const [projects, setProjects] = useState<{ currentRoot?: string; items?: Record<string, any> }>({});
  useEffect(() => { (async () => {
    try { const r = await fetch(`${API_BASE}/api/settings`); const j = await r.json(); setRoot(j.PROJECT_ROOT || ''); } catch {}
    try { const pr = await fetch(`${API_BASE}/api/projects`).then(res=>res.json()); setProjects(pr); } catch {}
  })(); }, []);
  if (!root) return null;
  const items = projects.items || {};
  const names = Object.keys(items);
  return (
    <div className="bg-blue-50 dark:bg-blue-950 border-b border-blue-200 dark:border-blue-900 px-6 py-2 text-sm flex items-center gap-3 flex-wrap">
      <span className="text-blue-900 dark:text-blue-200">Project:</span>
      <code className="text-blue-900 dark:text-blue-200 truncate max-w-[40ch]">
        {items[root]?.id ? `#${items[root].id} - ` : ''}{items[root]?.name || root}
      </code>
      {names.length > 1 && (
        <select className="border rounded px-2 py-0.5" onChange={async (e)=>{
          const sel = e.target.value;
          if (!sel) return;
          const projectId = parseInt(sel, 10);
          if (!isNaN(projectId)) {
            try {
              await fetch(`${API_BASE}/api/projects/switch`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: projectId })
              });
              window.location.reload();
            } catch {}
          }
        }} value="">
          <option value="">Switch…</option>
          {names.filter(r=>r!==root).map((r)=> (
            <option key={r} value={items[r]?.id || ''}>
              {items[r]?.id ? `#${items[r].id} - ` : ''}{items[r]?.name || r}
            </option>
          ))}
        </select>
      )}
      <button className="ml-auto px-2 py-0.5 rounded bg-blue-600 text-white" onClick={() => {
        onChange?.();
        const el = document.getElementById('project-root-panel');
        el?.scrollIntoView({ behavior: 'smooth' });
      }}>Change</button>
    </div>
  );
}
