import { performance } from 'perf_hooks';
import fs from 'fs';
import { readDotEnv } from './envFile';

export async function tryConnect(url: string) {
  const start = performance.now();
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  const { Client } = await import('pg');
  const env = readDotEnv();
  const caPath = env.PG_SSL_CA_PATH || process.env.PG_SSL_CA_PATH;
  const verify = (env.PG_SSL_VERIFY || process.env.PG_SSL_VERIFY) === 'true';
  const ssl = url.includes('sslmode=require') || url.includes('sslmode=verify-full')
    ? (verify && caPath && fs.existsSync(caPath)
      ? { ca: fs.readFileSync(caPath, 'utf8'), rejectUnauthorized: true }
      : { rejectUnauthorized: false })
    : undefined;
  const client = new Client({ connectionString: url, ssl });
  try {
    await client.connect();
    const res = await client.query('select version();');
    await client.end();
    return { ok: true as const, latencyMs: Math.round(performance.now() - start), serverVersion: res?.rows?.[0]?.version || '' };
  } catch (err: any) {
    try { await client.end(); } catch {}
    return { ok: false as const, latencyMs: Math.round(performance.now() - start), error: err?.message || String(err) };
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
    const extensions = res.rows.map((r: any) => String(r.extname));
    return { ok: true as const, extensions };
  } catch (err: any) {
    try { await client.end(); } catch {}
    return { ok: false as const, error: err?.message || String(err) };
  }
}
