import React, { useEffect, useMemo, useState } from 'react';
import type { EnvState, ProfileName } from '../api';
import { fetchEnvState, saveEnvState, testConnection } from '../api';
import { lintUrl, fixUrl } from '../utils/urlLint';

type FieldKey = 'LOCAL_DATABASE_URL' | 'SHADOW_DATABASE_URL' | 'DATABASE_URL' | 'DIRECT_URL';

const LABELS: Record<FieldKey, string> = {
  LOCAL_DATABASE_URL: 'Local Database URL',
  SHADOW_DATABASE_URL: 'Shadow Database URL',
  DATABASE_URL: 'Supabase Pooled (DATABASE_URL)',
  DIRECT_URL: 'Supabase Direct (DIRECT_URL)',
};

const HINTS: Partial<Record<FieldKey, string>> = {
  DATABASE_URL: 'Should include pgbouncer=true, connection_limit=1, sslmode=require, schema=public',
  DIRECT_URL: 'Must include sslmode=require and schema=public',
};

export default function ProfileEditor() {
  const [state, setState] = useState<EnvState | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchEnvState()
      .then(setState)
      .finally(() => setLoading(false));
  }, []);

  const active: ProfileName = useMemo(() => state?.ACTIVE_PROFILE || 'local', [state]);

  function updateField(field: FieldKey, value: string) {
    if (!state) return;
    setState({
      ...state,
      profiles: {
        ...state.profiles,
        [active]: { ...state.profiles[active], [field]: value },
      },
    });
  }

  async function onSave() {
    if (!state) return;
    setSaving(true);
    try {
      await saveEnvState(state);
    } finally {
      setSaving(false);
    }
  }

  async function fixAndSave(field: FieldKey) {
    if (!state) return;
    const kind = field === 'DIRECT_URL' ? 'direct' : field === 'DATABASE_URL' ? 'pooled' : undefined;
    if (!kind) return;
    const current = (state.profiles[active] as any)[field] as string | undefined;
    if (!current) return;
    const fixed = fixUrl(kind as any, current);
    const next: EnvState = {
      ...state,
      profiles: { ...state.profiles, [active]: { ...state.profiles[active], [field]: fixed } },
    };
    setSaving(true);
    try {
      await saveEnvState(next);
      setState(next);
    } finally {
      setSaving(false);
    }
  }

  function setActive(p: ProfileName) {
    if (!state) return;
    setState({ ...state, ACTIVE_PROFILE: p });
  }

  async function onTest(url?: string, label?: string) {
    if (!url) return;
    const k = label || 'Test';
    setTesting((t) => ({ ...t, [k]: 'Testing…' }));
    try {
      const res = await testConnection(url);
      setTesting((t) => ({
        ...t,
        [k]: res.ok ? `OK in ${res.latencyMs}ms${res.serverVersion ? ' — ' + res.serverVersion : ''}` : `Error: ${res.error}`,
      }));
    } catch (e: any) {
      setTesting((t) => ({ ...t, [k]: `Request failed: ${e?.message || e}` }));
    }
  }

  if (loading || !state) return <div className="p-6">Loading…</div>;

  const profile = state.profiles[active];

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Environment Profiles</h1>

      <div className="flex gap-2 items-center">
        <span className="text-sm text-gray-600">Active profile:</span>
        {(['local', 'staging', 'prod'] as ProfileName[]).map((p) => (
          <button
            key={p}
            onClick={() => setActive(p)}
            className={`px-3 py-1 rounded border ${active === p ? 'bg-blue-600 text-white border-blue-700' : 'bg-white'} `}
          >
            {p}
          </button>
        ))}
        <button
          onClick={onSave}
          className="ml-auto px-4 py-2 rounded bg-green-600 text-white disabled:opacity-60"
          disabled={saving}
        >
          {saving ? 'Saving…' : 'Save to .env'}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {(Object.keys(LABELS) as FieldKey[]).map((key) => (
          <div key={key} className="bg-white dark:bg-gray-900 rounded border dark:border-gray-700 p-4 space-y-2">
            <label className="block text-sm font-medium">{LABELS[key]}</label>
            <input
              className="w-full border rounded px-3 py-2"
              placeholder={LABELS[key]}
              value={(profile as any)[key] || ''}
              onChange={(e) => updateField(key, e.target.value)}
            />
            {HINTS[key] && <p className="text-xs text-gray-500">{HINTS[key]}</p>}
            <div className="flex flex-wrap gap-2 items-center">
              {(() => {
                const url = (profile as any)[key] as string | undefined;
                if (!url) return null;
                const kind = key === 'DIRECT_URL' ? 'direct' : key === 'DATABASE_URL' ? 'pooled' : undefined;
                if (!kind) return null;
                const warns = lintUrl(kind as any, url);
                return (
                  <>
                    {warns.map((w, i) => (
                      <span key={i} className="px-2 py-0.5 rounded text-xs bg-yellow-100 text-yellow-800">{w}</span>
                    ))}
                    {warns.length > 0 && (
                      <button
                        className="ml-2 text-xs px-2 py-0.5 rounded bg-gray-200 hover:bg-gray-300 dark:bg-gray-800 dark:hover:bg-gray-700 dark:text-gray-100 dark:border dark:border-gray-600"
                        onClick={() => updateField(key, fixUrl(kind as any, url))}
                      >Auto-fix</button>
                    )}
                    {warns.length > 0 && (
                      <button
                        className="text-xs px-2 py-0.5 rounded bg-green-600 text-white hover:bg-green-700"
                        onClick={() => fixAndSave(key)}
                        disabled={saving}
                      >Fix & Save</button>
                    )}
                  </>
                );
              })()}
            </div>
            <div className="flex gap-2">
              <button
                className="text-sm px-3 py-1 rounded bg-blue-600 text-white"
                onClick={() => onTest((profile as any)[key], LABELS[key])}
              >
                Test
              </button>
              <span className="text-sm text-gray-700">{testing[LABELS[key]]}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-yellow-50 border border-yellow-200 rounded p-4 text-sm text-yellow-900">
        <p className="font-medium mb-1">Validation tips</p>
        <ul className="list-disc ml-5 space-y-1">
          <li>DIRECT_URL should include sslmode=require and schema=public</li>
          <li>DATABASE_URL (pooled) should include pgbouncer=true, connection_limit=1, sslmode=require, schema=public</li>
        </ul>
      </div>
    </div>
  );
}
