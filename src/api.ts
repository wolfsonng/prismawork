export type ProfileName = 'local' | 'staging' | 'prod';

export type Profile = {
  LOCAL_DATABASE_URL?: string;
  SHADOW_DATABASE_URL?: string;
  DATABASE_URL?: string;
  DIRECT_URL?: string;
};

export type EnvState = {
  ACTIVE_PROFILE: ProfileName;
  profiles: Record<ProfileName, Profile>;
};

import { API_BASE } from './config';

export async function fetchEnvState(): Promise<EnvState> {
  const r = await fetch(`${API_BASE}/api/env/active-profile`);
  if (!r.ok) throw new Error('Failed to load env state');
  return r.json();
}

export async function saveEnvState(state: EnvState) {
  const r = await fetch(`${API_BASE}/api/env/save-profile`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(state),
  });
  if (!r.ok) throw new Error('Failed to save env');
  return r.json();
}

export async function testConnection(url: string) {
  const r = await fetch(`${API_BASE}/api/profiles/test-connection`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  });
  if (!r.ok) throw new Error('Failed to test');
  return r.json() as Promise<{ ok: boolean; latencyMs: number; error?: string; serverVersion?: string }>;
}

export type DiffSide = { kind: 'url' | 'schema' | 'migrations'; value?: string };
export async function diffPreview(from: DiffSide, to: DiffSide, opts?: { cwd?: string }) {
  const r = await fetch(`${API_BASE}/api/prisma/diff-preview`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to, cwd: opts?.cwd }),
  });
  if (!r.ok) throw new Error('Failed to diff');
  return r.json() as Promise<{ code: number | null; sql: string; args: string[] }>;
}

export async function fetchMigrations(): Promise<{ total: number; items: { name: string; label: string; dir: string; ts: string }[] }> {
  const r = await fetch(`${API_BASE}/api/prisma/migrations`);
  if (!r.ok) throw new Error('Failed to fetch migrations');
  return r.json();
}

export async function fetchAppliedMigrations(target: 'local' | 'shadow' | 'direct' | 'pooled' = 'direct') {
  const r = await fetch(`${API_BASE}/api/prisma/applied-migrations?target=${target}`);
  if (!r.ok) throw new Error('Failed to fetch applied migrations');
  return r.json() as Promise<{ target: string; total: number; items: { name: string; finished_at: string | null }[]; error?: string }>;
}
