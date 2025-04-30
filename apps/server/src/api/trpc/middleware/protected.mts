import { publicProcedure } from '../index.mjs';
import { TContext } from '../context.mjs';
import { TRPCError } from '@trpc/server';

export const protectedProcedure = publicProcedure.use(async (opts) => {
    const { meta, next, ctx } = opts;
    return next();
});
