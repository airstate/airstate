import { servicePlanePassthroughProcedure } from '../../middleware/passthrough.mjs';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';

export const docUpdatesSubscriptionProcedure = servicePlanePassthroughProcedure
    .input(
        z.object({
            key: z.string(),
            sessionID: z.string(),
            initialDynamicState: z.record(z.string(), z.any()),
        }),
    )
    .subscription(async function* ({ ctx, input, signal }) {
        if (!ctx.resolvedPermissions.presence.join) {
            throw new TRPCError({
                code: 'FORBIDDEN',
                message: 'you do not have permission to read yjs updates',
            });
        }
    });
