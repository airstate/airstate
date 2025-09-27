import { initTRPC } from '@trpc/server';
import type { TServicePlaneContext } from './context.mjs';
import { ZodError } from 'zod';
import { env } from '../../../env.mjs';

export interface Meta {
    writePermissionRequired: boolean;
}

const servicePlaneTRPC = initTRPC
    .context<TServicePlaneContext>()
    .meta<Meta>()
    .create({
        isDev: env.NODE_ENV !== 'production',
    });

export const servicePlaneRouter = servicePlaneTRPC.router;
export const servicePlaneMiddleware = servicePlaneTRPC.middleware;

export const servicePlanePublicProcedure = servicePlaneTRPC.procedure.use(async ({ path, next, type }) => {
    const result = await next();

    if (!result.ok && result.error.cause instanceof ZodError) {
        console.error(`validation error in ${type} ${path}:`, result.error.cause.issues);
    }

    return result;
});

export const createServicePlaneCallerFactory = servicePlaneTRPC.createCallerFactory;
