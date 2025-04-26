import { createEnv } from '@t3-oss/env-core';
import { z } from 'zod';

export const env = createEnv({
    server: {
        NODE_ENV: z.enum(['development', 'production']).default('development'),
        AIRSTATE_PORT: z.string().default('12006'),
        CONFIG_API_URL: z.string().default('http://localhost:12002'),
        NATS_URLS: z.string().default('nats://localhost:4222'),
        SHARED_SIGNING_KEY: z.string().optional(),
        DEFAULT_STATE_PERMISSION: z.enum(['read', 'read-write', 'none']).default('read-write'),
    },
    runtimeEnv: process.env,
});
