import { performance } from 'perf_hooks';
import fs from 'fs';
import type { ClientConfig } from 'pg';
import { readDotEnv } from './envFile';

export async function tryConnect(url: string) {
  const start = performance.now();
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  const { Client } = await import('pg');

  // Supabase URLs include extra query params not understood by postgres. Sanitize them.
  let cleanUrl = url;
  try {
    const u = new URL(url);
    const qp = u.searchParams;
    const schema = qp.get('schema');
    qp.delete('pgbouncer');
    qp.delete('connection_limit');
    qp.delete('schema');
    if (schema) {
      const opt = qp.get('options');
      const searchPath = `-c search_path=${schema}`;
      qp.set('options', opt ? `${opt} ${searchPath}` : searchPath);
    }
    cleanUrl = u.toString();
  } catch {
    // ignore parse errors and fall back to original url
  }

  const env = readDotEnv();
  const caPath = env.PG_SSL_CA_PATH || process.env.PG_SSL_CA_PATH;
  const verify = (env.PG_SSL_VERIFY || process.env.PG_SSL_VERIFY) === 'true';
  const opts: ClientConfig = { connectionString: cleanUrl };
  if (cleanUrl.includes('sslmode=require') || cleanUrl.includes('sslmode=verify-full')) {
    opts.ssl = verify && caPath && fs.existsSync(caPath)
      ? { ca: fs.readFileSync(caPath, 'utf8'), rejectUnauthorized: true }
      : { rejectUnauthorized: false };
  }
  const client = new Client(opts);
  try {
    await client.connect();
    const res = await client.query('select version();');
    await client.end();
    return { ok: true as const, latencyMs: Math.round(performance.now() - start), serverVersion: res?.rows?.[0]?.version || '' };
  } catch (err: unknown) {
    try { await client.end(); } catch { /* empty */ }
    const message = (err as { message?: string })?.message || String(err);
    return { ok: false as const, latencyMs: Math.round(performance.now() - start), error: message };
  }
}

export function lintUrl(kind: 'pooled' | 'direct', url: string) {
  const warn: string[] = [];
  try {
    // Parse query params
    const u = new URL(url);
    const qp = u.searchParams;
    if (kind === 'direct') {
      if (qp.get('sslmode') !== 'require') warn.push('sslmode=require missing');
      if ((qp.get('schema') || '') !== 'public') warn.push('schema=public recommended');
    } else {
      if (qp.get('pgbouncer') !== 'true') warn.push('pgbouncer=true missing');
      if (qp.get('connection_limit') !== '1') warn.push('connection_limit=1 missing');
      if (qp.get('sslmode') !== 'require') warn.push('sslmode=require missing');
      if ((qp.get('schema') || '') !== 'public') warn.push('schema=public recommended');
    }
  } catch {
    warn.push('Invalid URL');
  }
  return warn;
}

export async function listExtensions(url: string) {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  const { Client } = await import('pg');
  const client = new Client({ connectionString: url, ssl: url.includes('sslmode=require') ? { rejectUnauthorized: false } : undefined });
  try {
    await client.connect();
    const res = await client.query('select extname from pg_extension order by extname;');
    await client.end();
    const extensions = res.rows.map((r: { extname: unknown }) => String(r.extname));
    return { ok: true as const, extensions };
  } catch (err: unknown) {
    try { await client.end(); } catch { /* empty */ }
    const message = (err as { message?: string })?.message || String(err);
    return { ok: false as const, error: message };
  }
}
