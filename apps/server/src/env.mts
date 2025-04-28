import { createEnv } from '@t3-oss/env-core';
import { z } from 'zod';

export const env = createEnv({
    server: {
        NODE_ENV: z.enum(['development', 'production']).default('development'),
        PORT: z.string().optional(),
        AIRSTATE_PORT: z.string().optional(),
        NATS_URLS: z.string().default('nats://localhost:4222'),
    },
    runtimeEnv: process.env,
});
