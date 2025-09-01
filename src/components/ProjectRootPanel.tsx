import { API_BASE } from '../config';
import React, { useEffect, useState } from 'react';

export default function ProjectRootPanel() {
  const [root, setRoot] = useState('');
  const [status, setStatus] = useState<string>('');
  const [valid, setValid] = useState<boolean>(false);
  const [canBrowse, setCanBrowse] = useState<boolean>(true);
  const [projects, setProjects] = useState<{ currentRoot?: string; items?: Record<string, any> }>({});
  const [name, setName] = useState('');

  useEffect(() => {
    (async () => {
      try {
        // Detect platform dialog availability (mac/win ok; linux needs zenity/kdialog)
        const avail = await fetch(`${API_BASE}/api/system/dialog-availability`).then(r=>r.json()).catch(()=>({available:true}));
        setCanBrowse(!!avail.available);
        const r = await fetch(`${API_BASE}/api/settings`);
        const j = await r.json();
        setRoot(j.PROJECT_ROOT || j.SCRIPTS_CWD || j.SEEDS_CWD || '');
        if (j.PROJECT_ROOT) validate(j.PROJECT_ROOT);
        // load recent projects
        try {
          const pr = await fetch(`${API_BASE}/api/projects`).then(res=>res.json());
          setProjects(pr);
        } catch {}
      } catch {}
    })();
  }, []);

  async function browse() {
    setStatus('');
    try {
      const r = await fetch(`${API_BASE}/api/system/choose-folder`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: 'Select project root (contains package.json and prisma/schema.prisma)' }) });
      const text = await r.text();
      let j: any = {};
      try { j = JSON.parse(text); } catch { setStatus('Folder dialog returned non-JSON (is the backend running at localhost:6580?)'); return; }
      if (r.ok && j.path) {
        setRoot(j.path);
        // auto-validate and save for one-click flow
        try {
          const vr = await fetch(`${API_BASE}/api/system/validate-project?path=${encodeURIComponent(j.path)}`);
          const vt = await vr.text();
          const vj = JSON.parse(vt);
          if (vj.ok) {
            await fetch(`${API_BASE}/api/projects/select`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ root: j.path }) });
            setValid(true);
            setStatus('Saved');
            // refresh recent list
            try { const pr = await fetch(`${API_BASE}/api/projects`).then(res=>res.json()); setProjects(pr); } catch {}
          } else {
            setValid(false);
            setStatus('Selected folder missing package.json or prisma/schema.prisma');
          }
        } catch {}
      } else setStatus(j.error || 'Cancelled');
    } catch (e: any) { setStatus(e?.message || 'Dialog failed'); }
  }

  async function validate(p?: string) {
    try {
      const r = await fetch(`${API_BASE}/api/system/validate-project?path=${encodeURIComponent(p ?? root)}`);
      const text = await r.text();
      let j: any = {};
      try { j = JSON.parse(text); } catch { setStatus('Backend returned non-JSON. Ensure server is running at localhost:6580.'); setValid(false); return; }
      if (j.ok) { setValid(true); setStatus('Looks good'); }
      else { setValid(false); setStatus(`Missing: ${!j.hasPackageJson?'package.json ':''}${!j.hasSchema?'prisma/schema.prisma':''}`.trim()); }
    } catch (e: any) { setStatus(e?.message || 'Validate failed'); setValid(false); }
  }

  async function save() {
    try {
      const r = await fetch(`${API_BASE}/api/projects/select`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ root, name: name || undefined }) });
      const t = await r.text();
      let j: any = {};
      try { j = JSON.parse(t); } catch { setStatus('Backend returned non-JSON while saving'); return; }
      if (j.ok) setStatus('Saved'); else setStatus(j.error || 'Save failed');
      // refresh list
      try { const pr = await fetch(`${API_BASE}/api/projects`).then(res=>res.json()); setProjects(pr); } catch {}
    } catch (e: any) { setStatus(e?.message || 'Save failed'); }
  }

  return (
    <div id="project-root-panel" className="bg-white dark:bg-gray-900 rounded border dark:border-gray-700 p-4 space-y-2">
      <div className="flex items-center gap-2">
        <h2 className="text-lg font-semibold">Project Root</h2>
        {valid ? <span className="px-2 py-0.5 rounded text-xs bg-green-100 text-green-800">valid</span> : <span className="px-2 py-0.5 rounded text-xs bg-yellow-100 text-yellow-800">not validated</span>}
        <div className="ml-auto flex gap-2">
          <button className="px-2 py-1 rounded bg-gray-200 dark:bg-gray-800 dark:text-gray-100 dark:border dark:border-gray-600 disabled:opacity-60" onClick={browse} disabled={!canBrowse} title={canBrowse? 'Pick via system dialog' : 'Folder dialog not available; enter path manually'}>Browse…</button>
          <button className="px-2 py-1 rounded bg-gray-200 dark:bg-gray-800 dark:text-gray-100 dark:border dark:border-gray-600" onClick={()=>validate()}>Validate</button>
          <button className="px-2 py-1 rounded bg-blue-600 text-white" onClick={save} disabled={!root}>Save</button>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        <input className="w-full border rounded px-3 py-1" value={root} onChange={(e)=>setRoot(e.target.value)} placeholder="/path/to/your-app" />
        <input className="w-full border rounded px-3 py-1" value={name} onChange={(e)=>setName(e.target.value)} placeholder="Optional name (e.g., Zauberstack API)" />
      </div>
      {projects.items && Object.keys(projects.items).length > 0 && (
        <div className="text-sm flex items-center gap-2">
          <span className="text-gray-600">Recent:</span>
          <select className="border rounded px-2 py-1" onChange={async (e)=>{
            const sel = e.target.value;
            if (!sel) return;
            setRoot(sel);
            try {
              await fetch(`${API_BASE}/api/projects/select`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ root: sel }) });
              setStatus('Switched');
              validate(sel);
            } catch {}
          }} value="">
            <option value="">Choose…</option>
            {Object.keys(projects.items).map((r)=> (
              <option key={r} value={r}>{(projects.items as any)[r]?.name || r}</option>
            ))}
          </select>
        </div>
      )}
      {status && <div className="text-xs text-gray-700">{status}</div>}
      <div className="text-xs text-gray-600">All panels use this root to locate package.json and prisma/ unless overridden.</div>
    </div>
  );
}
