import { z } from 'zod';
import { permissionsSchema } from './config.mjs';

export const tokenPayloadSchema = z
    .object({
        data: z.object({
            presence: z
                .object({
                    permissions: z
                        .object({
                            join: z.boolean().default(true),
                            update_state: z.boolean().default(true),
                        })
                        .partial()
                        .optional(),
                    peerId: z.string().optional(),
                    meta: z.record(z.string(), z.any()).optional(),
                })
                .optional(),
            yjs: z
                .object({
                    permissions: z
                        .object({
                            read: z.boolean().default(true),
                            write: z.boolean().default(true),
                        })
                        .partial()
                        .optional(),
                })
                .optional(),
        }),
    })
    .passthrough();

export type TTokenPayload = z.infer<typeof tokenPayloadSchema>;
