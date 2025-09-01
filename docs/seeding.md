% Seeding

Options

- npm run seed → your project's seed script
- prisma db seed → uses `"prisma": { "seed": "..." }` from package.json
- migrate reset + seed → resets local DB and runs seed

Configure

In your app's package.json:

```
{
  "scripts": {
    "seed": "tsx prisma/seed.ts"
  },
  "prisma": {
    "seed": "tsx prisma/seed.ts"
  }
}
```

Write `prisma/seed.ts` using `@prisma/client` with idempotent inserts.

