import { servicePlanePassthroughProcedure } from '../../middleware/passthrough.mjs';
import { z } from 'zod';
import { runInAction } from 'mobx';
import { TRPCError } from '@trpc/server';

export const clientInitMutationProcedure = servicePlanePassthroughProcedure
    .input(
        z.object({
            sessionId: z.string(),
            token: z.string(),
        }),
    )
    .mutation(async ({ input, ctx }) => {
        if (!(input.sessionId in ctx.services.localState.sessionMeta)) {
            throw new TRPCError({
                code: 'NOT_FOUND',
                message: 'session not found',
            });
        }

        if (ctx.services.localState.sessionMeta[input.sessionId].type !== 'server-state') {
            throw new TRPCError({
                code: 'CONFLICT',
                message: 'this session is not a server-state session.',
            });
        }

        runInAction(() => {
            ctx.services.localState.sessionMeta[input.sessionId].meta = {};
        });
    });

export type TClientInitMutationProcedure = typeof clientInitMutationProcedure;
