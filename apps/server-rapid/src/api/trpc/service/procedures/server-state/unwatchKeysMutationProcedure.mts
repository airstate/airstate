import { servicePlanePassthroughProcedure } from '../../middleware/passthrough.mjs';
import { z } from 'zod';

export const unwatchKeysMutationProcedure = servicePlanePassthroughProcedure
    .input(
        z.object({
            sessionId: z.string(),
            keys: z.string().array(),
        }),
    )
    .mutation(async ({ input, ctx }) => {
        // TODO: this entire thing
        return null as any;
    });

export type TUnwatchKeysMutationProcedure = typeof unwatchKeysMutationProcedure;
