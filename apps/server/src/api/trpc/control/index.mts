import { initTRPC } from '@trpc/server';
import type { TControlPlaneContext } from './context.mjs';
import { ZodError } from 'zod';
import { env } from '../../../env.mjs';

export interface Meta {
    writePermissionRequired: boolean;
}

const controlPlaneTRPC = initTRPC
    .context<TControlPlaneContext>()
    .meta<Meta>()
    .create({
        isDev: env.NODE_ENV !== 'production',
    });

export const controlPlaneRouter = controlPlaneTRPC.router;
export const controlPlaneMiddleware = controlPlaneTRPC.middleware;

export const controlPlanePublicProcedure = controlPlaneTRPC.procedure.use(async ({ path, next, type }) => {
    const result = await next();

    if (!result.ok && result.error.cause instanceof ZodError) {
        console.error(`validation error in ${type} ${path}:`, result.error.cause.issues);
    }

    return result;
});

export const createControlPlaneCallerFactory = controlPlaneTRPC.createCallerFactory;
