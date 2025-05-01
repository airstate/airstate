import { createEnv } from '@t3-oss/env-core';
import { z } from 'zod';

export const booleanEnvSchema = z.enum(['true', 'false', 'TRUE', 'FALSE']);

export const env = createEnv({
    server: {
        NODE_ENV: z.enum(['development', 'production']).default('development'),
        PORT: z.string().optional(),
        AIRSTATE_PORT: z.string().optional(),
        AIRSTATE_CONTROL_PORT: z.string().default('21001'),
        AIRSTATE_CONFIG_API_BASE_URL: z.string().trim().optional(),
        AIRSTATE_NATS_URLS: z.string().default('nats://localhost:4222'),
        VALKEY_CONNECTION_URL: z.string().default('redis://valkey:6379'),
        AIRSTATE_CLUSTER: z.string().optional(),
        SHARED_SIGNING_KEY: z.string().optional(),
        DEFAULT_YJS_READ_PERMISSION: booleanEnvSchema.default('true'),
        DEFAULT_YJS_WRITE_PERMISSION: booleanEnvSchema.default('true'),
        DEFAULT_PRESENCE_JOIN_PERMISSION: booleanEnvSchema.default('true'),
        DEFAULT_PRESENCE_UPDATE_STATE_PERMISSION: booleanEnvSchema.default('true'),
        DEFAULT_PRESENCE_READ_PRESENCE_PERMISSION: booleanEnvSchema.default('true'),
        DEFAULT_PRESENCE_READ_LAST_PERMISSION: z
            .string()
            .regex(/^[0-9]+$/)
            .default('0'),
        DEFAULT_PRESENCE_READ_SUMMARY_PERMISSION: booleanEnvSchema.default('true'),
    },
    runtimeEnv: process.env,
});
