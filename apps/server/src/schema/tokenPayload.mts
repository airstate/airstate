import { z } from 'zod';

export const tokenPayloadSchema = z
    .object({
        yjs: z.object({
            read: z.boolean(),
            write: z.boolean(),
        }),
    })
    .passthrough();

export type TTokenPayload = z.infer<typeof tokenPayloadSchema>;
