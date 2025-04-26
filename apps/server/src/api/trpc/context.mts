import * as trpcExpress from '@trpc/server/adapters/express';
import * as trpcWS from '@trpc/server/adapters/ws';
import { TServices } from '../../services.mjs';

export async function httpContextCreatorFactory(services: TServices) {
    return async function (options: trpcExpress.CreateExpressContextOptions | trpcWS.CreateWSSContextFnOptions) {
        const appKey = options.info.connectionParams?.appKey ?? null;

        return {
            appKey: appKey,
            services: services,
        };
    };
}

export type TContextCreator = Awaited<ReturnType<typeof httpContextCreatorFactory>>;
export type TContext = Awaited<ReturnType<TContextCreator>>;
