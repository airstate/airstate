import { z } from 'zod';
import { permissionsSchema } from './config.mjs';

export const tokenPayloadSchema = z
    .object({
        data: z.object({
            permissions: permissionsSchema.partial().optional(),
            presence: z
                .object({
                    peerKey: z.string().optional(),
                    staticState: z.record(z.string(), z.any()).optional(),
                })
                .optional(),
        }),
    })
    .passthrough();

export type TTokenPayload = z.infer<typeof tokenPayloadSchema>;
