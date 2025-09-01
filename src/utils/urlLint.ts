export function lintUrl(kind: 'pooled' | 'direct', url: string) {
  const warn: string[] = [];
  try {
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

export function fixUrl(kind: 'pooled' | 'direct', url: string) {
  try {
    const u = new URL(url);
    const qp = u.searchParams;
    if (kind === 'direct') {
      if (qp.get('sslmode') !== 'require') qp.set('sslmode', 'require');
      if (!qp.get('schema')) qp.set('schema', 'public');
    } else {
      if (qp.get('pgbouncer') !== 'true') qp.set('pgbouncer', 'true');
      if (qp.get('connection_limit') !== '1') qp.set('connection_limit', '1');
      if (qp.get('sslmode') !== 'require') qp.set('sslmode', 'require');
      if (!qp.get('schema')) qp.set('schema', 'public');
    }
    u.search = qp.toString();
    return u.toString();
  } catch {
    return url;
  }
}

