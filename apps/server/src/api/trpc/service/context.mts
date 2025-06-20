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
import { TRPCError } from '@trpc/server';

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

        const appKey = options.info.connectionParams?.appKey ?? null;

        await logQueue.push({
            level: 'warn',
            logs: ['%cNote: You are using a very early preview version of AirState.', 'padding: 0.5rem 0 0.5rem 0;'],
        });
        const clientID = options.info.connectionParams?.clientID ?? null;
        const connectionID = options.info.connectionParams?.connectionID ?? null;
        const serverHostname = options.req.headers['host'] ?? null;
        const clientPageHostname = options.info.connectionParams?.pageHostname ?? null;
        const userAgentString = options.req.headers['user-agent'] ?? null;

        const ipAddress =
            getFirstForwardedIPAddress(`${options.req.headers['x-forwarded-for']}`) ??
            options.req.socket.remoteAddress ??
            null;

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
                const configRequestURL = new URL(`${env.AIRSTATE_CONFIG_API_BASE_URL}/config`);
                configRequestURL.searchParams.set('appKey', appKey);

                const configRequest = await fetch(`${configRequestURL}`);
                return configSchema.parse(await configRequest.json());
            } catch (error) {
                logger.error(`could not get config for ${appKey}`, error);
                return null;
            }
        });

        const resolvedPermissions = resolvedConfig?.base_permissions
            ? merge(resolvedConfig.base_permissions, defaultPermissions)
            : defaultPermissions;

        if (env.NODE_ENV === 'production' && !resolvedConfig?.account_id) {
            logger.error(`could not get accountID for ${appKey}`);
            throw new TRPCError({
                code: 'UNAUTHORIZED',
                message: 'invalid or missing appKey. cannot resolve account in production.',
            });
        }

        return {
            accountID: resolvedConfig?.account_id ?? '__ANONYMOUS',
            connectionID: nanoid(),
            appKey: appKey,
            appSecret: resolvedConfig?.app_secret ?? env.SHARED_SIGNING_KEY,
            clientSentConnectionID: connectionID,
            clientSentClientID: clientID,
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
