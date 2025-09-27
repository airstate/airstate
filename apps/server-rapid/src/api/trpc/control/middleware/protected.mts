import { controlPlanePublicProcedure } from '../index.mjs';
import { TControlPlaneContext } from '../context.mjs';
import { TRPCError } from '@trpc/server';

export const controlPlanePassthroughProcedure = controlPlanePublicProcedure.use(async (opts) => {
    const { meta, next, ctx } = opts;
    return next();
});
