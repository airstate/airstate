import { initTRPC } from '@trpc/server';
import type { TContext } from './context.mjs';
import { ZodError } from 'zod';
import { env } from '../../env.mjs';

const t = initTRPC.context<TContext>().create({
    isDev: env.NODE_ENV !== 'production',
});

export const router = t.router;
export const middleware = t.middleware;

export const publicProcedure = t.procedure.use(async ({ path, next, type }) => {
    const result = await next();

    if (!result.ok && result.error.cause instanceof ZodError) {
        console.error(`validation error in ${type} ${path}:`, result.error.cause.issues);
    }

    return result;
});

export const createCallerFactory = t.createCallerFactory;
