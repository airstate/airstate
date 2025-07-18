import { createEnv } from '@t3-oss/env-core';
import { z } from 'zod';

export const booleanEnvSchema = z.enum(['true', 'false', 'TRUE', 'FALSE']);

export const env = createEnv({
    server: {
        NODE_ENV: z.enum(['development', 'production']).default('production'),

        PORT: z.string().optional(),
        AIRSTATE_PORT: z.string().optional(), // don't document

        CONTROL_PORT: z.string().optional(), // don't document
        AIRSTATE_CONTROL_PORT: z.string().optional(), // don't document

        AIRSTATE_CONFIG_API_BASE_URL: z.string().trim().optional(),

        NATS_URL: z.string().optional(),
        AIRSTATE_NATS_URL: z.string().optional(), // don't document

        REDIS_URL: z.string().optional(),
        VALKEY_URL: z.string().optional(), // don't document
        AIRSTATE_REDIS_URL: z.string().optional(), // don't document
        AIRSTATE_VALKEY_URL: z.string().optional(), // don't document

        AIRSTATE_CLUSTER: z.string().optional(), // don't document

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
