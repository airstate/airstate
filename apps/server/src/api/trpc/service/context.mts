import * as trpcExpress from '@trpc/server/adapters/express';
import * as trpcWS from '@trpc/server/adapters/ws';
import { TServices } from '../../../services.mjs';
import { nanoid } from 'nanoid';
import { returnOf } from 'scope-utilities';
import { env } from '../../../env.mjs';
import { configSchema, TPermissions } from '../../../schema/config.mjs';
import { logger } from '../../../logger.mjs';
import { merge } from 'es-toolkit/object';
import { AsyncIterableQueue } from 'async-iterable-queue';
import { ConsoleMessage } from '../../../schema/consoleMessage.mjs';
import { getFirstForwardedIPAddress } from '../../../utils/ip/request.mjs';

export const defaultPermissions: TPermissions = {
    presence: {
        join: true,
        update_state: true,
    },
    yjs: {
        read: true,
        write: true,
    },
};

export async function servicePlaneHTTPContextCreatorFactory(services: TServices) {
    return async function (options: trpcExpress.CreateExpressContextOptions | trpcWS.CreateWSSContextFnOptions) {
        const logQueue = new AsyncIterableQueue<ConsoleMessage>();

        // `appKey` is DEPRECATED. `appId` preferred.
        const appId = options.info.connectionParams?.appId ?? options.info.connectionParams?.appKey ?? null;

        await logQueue.push({
            level: 'warn',
            logs: ['%cNote: You are using a very early preview version of AirState.', 'padding: 0.5rem 0 0.5rem 0;'],
        });

        // `clientID` is DEPRECATED. `clientId` preferred.
        const clientSentId = options.info.connectionParams?.clientId ?? options.info.connectionParams?.clientID ?? null;
        const clientId = `${appId}:${clientSentId}`;

        // `connectionID` is DEPRECATED. `connectionId` preferred.
        const connectionId =
            options.info.connectionParams?.connectionId ?? options.info.connectionParams?.connectionID ?? null;

        const serverHostname = options.req.headers['host'] ?? null;
        const clientPageHostname = options.info.connectionParams?.pageHostname ?? null;
        const userAgentString = options.req.headers['user-agent'] ?? null;

        const ipAddress =
            getFirstForwardedIPAddress(`${options.req.headers['x-forwarded-for']}`) ??
            options.req.socket.remoteAddress ??
            null;

        const resolvedConfig = await returnOf(async () => {
            // TODO: remove this; this is how you get the socket -> options.req.socket;

            if (!appId) {
                logger.warn(`no appKey set`);
                return null;
            }

            if (!env.AIRSTATE_CONFIG_API_BASE_URL) {
                logger.warn(`no config api base url set`);
                return null;
            }

            try {
                const configRequestURL = new URL(`${env.AIRSTATE_CONFIG_API_BASE_URL}/config`);
                configRequestURL.searchParams.set('appId', appId);

                const configRequest = await fetch(`${configRequestURL}`);
                return configSchema.parse(await configRequest.json());
            } catch (error) {
                logger.error(`could not get config for ${appId}`, error);
                return null;
            }
        });

        const resolvedPermissions = resolvedConfig?.base_permissions
            ? merge(resolvedConfig.base_permissions, defaultPermissions)
            : defaultPermissions;

        return {
            namespace: resolvedConfig?.namespace ?? '__default',
            connectionId: nanoid(),
            appId: appId,
            appSecret: resolvedConfig?.app_secret ?? env.SHARED_SIGNING_KEY,
            clientSentConnectionID: connectionId,
            clientId: clientId,
            clientIPAddress: ipAddress,
            clientUserAgentString: userAgentString,
            clientPageHostname: clientPageHostname,
            serverHostname: serverHostname,
            resolvedConfig: resolvedConfig,
            services: services,
            permissions: resolvedPermissions,
            logQueue: logQueue,
        };
    };
}

export type TServicePlaneContextCreator = Awaited<ReturnType<typeof servicePlaneHTTPContextCreatorFactory>>;
export type TServicePlaneContext = Awaited<ReturnType<TServicePlaneContextCreator>>;
