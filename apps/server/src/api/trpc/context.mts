import * as trpcExpress from '@trpc/server/adapters/express';
import * as trpcWS from '@trpc/server/adapters/ws';
import { TServices } from '../../services.mjs';
import { nanoid } from 'nanoid';
import { returnOf } from 'scope-utilities';
import { env } from '../../env.mjs';
import { configSchema } from '../../schema/config.mjs';
import { logger } from '../../logger.mjs';

export async function httpContextCreatorFactory(services: TServices) {
    return async function (options: trpcExpress.CreateExpressContextOptions | trpcWS.CreateWSSContextFnOptions) {
        const appKey = options.info.connectionParams?.appKey ?? null;

        const resolvedConfig = await returnOf(async () => {
            if (!appKey) {
                logger.warn(`no appKey set`);
                return null;
            }

            if (!env.AIRSTATE_CONFIG_API_BASE_URL) {
                logger.warn(`no config api base url set`);
                return null;
            }

            try {
                const configRequestURL = new URL(`${env.AIRSTATE_CONFIG_API_BASE_URL}/getConfigFromAppKey`);
                configRequestURL.searchParams.set('appKey', appKey);

                const configRequest = await fetch(`${configRequestURL}`);
                return configSchema.parse(await configRequest.json());
            } catch (error) {
                logger.error(`could not get config for ${appKey}`, error);
                return null;
            }
        });

        return {
            accountingIdentifier: resolvedConfig?.accounting_identifier ?? '__ANONYMOUS',
            connectionID: nanoid(),
            appKey: appKey,
            resolvedConfig: resolvedConfig,
            services: services,
        };
    };
}

export type TContextCreator = Awaited<ReturnType<typeof httpContextCreatorFactory>>;
export type TContext = Awaited<ReturnType<TContextCreator>>;
