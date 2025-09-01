% Prisma Commands

- format: Formats your Prisma schema file.
- generate: Regenerates the Prisma Client.
- migrate dev: Applies migrations to your local DB and updates the shadow DB.
- migrate status: Shows pending/applied migration summary.
- migrate diff: Shows SQL changes between DIRECT_URL and local schema.
- migrate deploy: Applies pending migrations to DIRECT_URL (Supabase direct).
- db pull: Introspects DB at DIRECT_URL and updates schema.prisma.

Environment resolution

- migrate dev → uses LOCAL_DATABASE_URL + SHADOW_DATABASE_URL
- deploy/diff/status/db pull → use DIRECT_URL (also assigned to DATABASE_URL)

