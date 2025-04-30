import { z } from 'zod';
import { permissionsSchema } from './config.mjs';

export const tokenPayloadSchema = z
    .object({
        permissions: permissionsSchema,
    })
    .passthrough();

export type TTokenPayload = z.infer<typeof tokenPayloadSchema>;
