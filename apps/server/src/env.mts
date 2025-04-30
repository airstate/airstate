import { createEnv } from '@t3-oss/env-core';
import { z } from 'zod';

export const env = createEnv({
    server: {
        NODE_ENV: z.enum(['development', 'production']).default('development'),
        PORT: z.string().optional(),
        AIRSTATE_CONFIG_FILE: z.string().trim().optional(),
        AIRSTATE_PORT: z.string().optional(),
        AIRSTATE_CONFIG_API_BASE_URL: z.string().trim().optional(),
        AIRSTATE_NATS_URLS: z.string().default('nats://localhost:4222'),
        SHARED_SIGNING_KEY: z.string().optional(),
        DEFAULT_YJS_PERMISSION: z.enum(['none', 'read', 'read-write']).default('read-write'),
    },
    runtimeEnv: process.env,
});
