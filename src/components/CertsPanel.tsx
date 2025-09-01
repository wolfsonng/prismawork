import { API_BASE } from '../config';
import React, { useEffect, useState } from 'react';

export default function CertsPanel() {
  const [caPath, setCaPath] = useState('');
  const [dumpPath, setDumpPath] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string>('');
  const [verify, setVerify] = useState(false);

  async function load() {
    const r = await fetch(`${API_BASE}/api/settings`);
    const j = await r.json();
    setCaPath(j.PG_SSL_CA_PATH || '');
    setDumpPath(j.PG_DUMP_PATH || '');
    setVerify(!!j.PG_SSL_VERIFY);
  }

  useEffect(() => { load(); }, []);

  async function onUpload(file: File) {
    const buf = await file.arrayBuffer();
    const b64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
    setBusy(true);
    setMsg('');
    try {
      const r = await fetch(`${API_BASE}/api/certs/upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: file.name, contentBase64: b64, setAsDefault: true }),
      });
      const j = await r.json();
      if (j.ok) {
        setMsg(`Saved: ${j.path}`);
        setCaPath(j.path);
      } else {
        setMsg(j.error || 'Upload failed');
      }
    } finally {
      setBusy(false);
    }
  }

  async function saveSettings() {
    setBusy(true);
    setMsg('');
    try {
      await fetch(`${API_BASE}/api/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ PG_SSL_CA_PATH: caPath, PG_DUMP_PATH: dumpPath, PG_SSL_VERIFY: verify }),
      });
      setMsg('Settings saved');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="bg-white dark:bg-gray-900 rounded border dark:border-gray-700 p-4 space-y-3">
      <h2 className="text-lg font-semibold">Certificates & Tools</h2>
      <div className="space-y-2">
        <div className="text-sm font-medium">Supabase CA certificate</div>
        <div className="flex gap-2 items-center">
          <input type="file" accept=".crt,.pem" onChange={(e) => e.target.files && e.target.files[0] && onUpload(e.target.files[0])} disabled={busy} />
          <input className="flex-1 border rounded px-3 py-1" value={caPath} onChange={(e) => setCaPath(e.target.value)} placeholder="Path to CA .crt/.pem" />
        </div>
        <div className="text-xs text-gray-600">Used for connection tests and pg_dump; stored locally under ./server/cert when uploaded.</div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={verify} onChange={(e) => setVerify(e.target.checked)} />
          Verify server certificate (strict)
        </label>
      </div>
      <div className="space-y-2">
        <div className="text-sm font-medium">pg_dump path</div>
        <input className="w-full border rounded px-3 py-1" value={dumpPath} onChange={(e) => setDumpPath(e.target.value)} placeholder="/usr/local/bin/pg_dump" />
      </div>
      <div className="flex items-center gap-2">
        <button className="px-3 py-1 rounded bg-blue-600 text-white disabled:opacity-60" onClick={saveSettings} disabled={busy}>Save Settings</button>
        {msg && <div className="text-sm text-gray-700">{msg}</div>}
      </div>
    </div>
  );
}
