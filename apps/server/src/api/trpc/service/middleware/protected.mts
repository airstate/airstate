import { servicePlanePublicProcedure } from '../index.mjs';
import { TContext } from '../context.mjs';
import { TRPCError } from '@trpc/server';

export const servicePlanePassthroughProcedure = servicePlanePublicProcedure.use(async (opts) => {
    const { meta, next, ctx } = opts;
    return next();
});
