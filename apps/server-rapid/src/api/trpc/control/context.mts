import * as trpcExpress from '@trpc/server/adapters/express';
import * as trpcWS from '@trpc/server/adapters/ws';
import { TServices } from '../../../services.mjs';

export async function controlPlaneHTTPContextCreatorFactory(services: TServices) {
    return async function (options: trpcExpress.CreateExpressContextOptions | trpcWS.CreateWSSContextFnOptions) {
        return {
            services: services,
        };
    };
}

export type TControlPlaneContextCreator = Awaited<ReturnType<typeof controlPlaneHTTPContextCreatorFactory>>;
export type TControlPlaneContext = Awaited<ReturnType<TControlPlaneContextCreator>>;
