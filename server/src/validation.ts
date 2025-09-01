import { z } from 'zod';

export const profileNameSchema = z.enum(['local', 'staging', 'prod']);

export const profileSchema = z.object({
  LOCAL_DATABASE_URL: z.string().optional().default(''),
  SHADOW_DATABASE_URL: z.string().optional().default(''),
  DATABASE_URL: z.string().optional().default(''),
  DIRECT_URL: z.string().optional().default(''),
});

export const envStateSchema = z.object({
  ACTIVE_PROFILE: profileNameSchema,
  profiles: z.object({
    local: profileSchema,
    staging: profileSchema,
    prod: profileSchema,
  }),
});

export const testConnectionBody = z.object({ url: z.string().min(1) });

export type TestConnectionBody = z.infer<typeof testConnectionBody>;

export const diffEndpointBody = z.object({
  from: z.object({
    kind: z.enum(['url', 'schema', 'migrations']),
    value: z.string().optional(),
  }),
  to: z.object({
    kind: z.enum(['url', 'schema', 'migrations']),
    value: z.string().optional(),
  }),
  cwd: z.string().optional(),
});

export type DiffEndpointBody = z.infer<typeof diffEndpointBody>;
