% Development Workflow

1) Edit your schema in `prisma/schema.prisma`.
2) Run "migrate dev" against LOCAL_DATABASE_URL and SHADOW_DATABASE_URL.
3) Review generated SQL and test locally.
4) Preview SQL diff against Supabase Direct.
5) Run "migrate deploy" to apply migrations to Supabase.
6) Seed data as needed to support your UI/API work.

Tips

- Keep `directUrl` and `shadowDatabaseUrl` in your datasource set to env vars.
- Prefer small, frequent migrations with clear names.
- Use the Pre‑Deploy checklist before deploying.

