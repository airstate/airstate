import { publicProcedure } from '../index.mjs';
import { TContext } from '../context.mjs';
import { TRPCError } from '@trpc/server';

export const protectedProcedure = publicProcedure.use(async (opts) => {
    const { meta, next, ctx } = opts;

    if (meta?.writePermissionRequired && !ctx.resolvedPermission.write) {
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'you do not have permission to write' });
    }
    if (!(ctx.resolvedPermission.read || ctx.resolvedPermission.write)) {
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'you do not have permission to read or write' });
    }
    return next();
});
