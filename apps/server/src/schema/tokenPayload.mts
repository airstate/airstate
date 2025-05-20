import { z } from 'zod';
import { permissionsSchema } from './config.mjs';

export const tokenPayloadSchema = z
    .object({
        permissions: permissionsSchema.partial().optional(),
    })
    .passthrough();

export type TTokenPayload = z.infer<typeof tokenPayloadSchema>;
