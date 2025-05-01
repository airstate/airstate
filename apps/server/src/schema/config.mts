import { z } from 'zod';

export const permissionsSchema = z.object({
    yjs: z
        .object({
            read: z.boolean().default(true),
            write: z.boolean().default(true),
        })
        .optional(),
    presence: z
        .object({
            join: z.boolean().default(true),
            update_state: z.boolean().default(true),
            read_presence: z.boolean().default(true),
            read_last: z.number().min(0).default(0),
            read_summary: z.boolean().default(true),
        })
        .optional(),
});

export type TPermissions = z.infer<typeof permissionsSchema>;

export const configSchema = z.object({
    version: z.literal('1.0'),
    signing_secret: z.string().optional(),
    accounting_identifier: z
        .string()
        .regex(/^(_[A-Za-z0-9_]*)|([A-Za-z][A-Za-z0-9_]*)$/)
        .optional(),
    init_logs: z
        .array(
            z.object({
                level: z.enum(['debug', 'info', 'warning', 'error']),
                arguments: z.string().array(),
            }),
        )
        .optional(),
    init_error: z.string().optional(),
    default_permissions: permissionsSchema,
});

export type TConfig = z.infer<typeof configSchema>;
