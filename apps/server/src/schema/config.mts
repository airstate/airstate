import { z } from 'zod';

export const permissionsSchema = z.object({
    yjs: z.object({
        read: z.boolean().default(true),
        write: z.boolean().default(true),
    }),
    presence: z.object({
        join: z.boolean().default(true),
        update_state: z.boolean().default(true),
    }),
});

export type TPermissions = z.infer<typeof permissionsSchema>;

export const configSchema = z.object({
    version: z.literal('1.0'),
    app_secret: z.string().optional(),
    account_id: z
        .string()
        .regex(/^(_[A-Za-z0-9_]*)|([A-Za-z][A-Za-z0-9_]*)$/)
        .optional(),
    init: z
        .object({
            logs: z
                .array(
                    z.object({
                        level: z.enum(['debug', 'info', 'warning', 'error']),
                        arguments: z.string().array(),
                    }),
                )
                .optional(),
            error: z.string().optional(),
        })
        .optional(),
    base_permissions: permissionsSchema.partial(),
});

export type TConfig = z.infer<typeof configSchema>;
