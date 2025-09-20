import { env } from '../env.mjs';
import { createTRPCClient, createWSClient, wsLink } from '@trpc/client';
import { TControlPlaneAppRouter } from '../api/trpc/control/routers/index.mjs';
import { logger } from '../logger.mjs';
import { controlPlanePort } from '../init/_derivations.mjs';

export async function createControlClients() {
    const clusterURLs = env.AIRSTATE_CLUSTER ?? `ws://localhost:${controlPlanePort}`;

    const clusterURLArray = clusterURLs
        .split(',')
        .map((url) => url.trim())
        .filter((url) => url.length > 0);

    const clients = clusterURLArray.map((url) => {
        let isOpen = false;
        let runId: string | null = null;

        const wsClient = createWSClient({
            url: `${url}/ws`,
            keepAlive: {
                enabled: true,
                intervalMs: 5_000,
                pongTimeoutMs: 2_500,
            },
            async onOpen() {
                isOpen = true;

                const info = await trpcClient.info.query();
                runId = info.runId;
            },
            onClose() {
                isOpen = false;
            },
            onError(errorEvent) {
                logger.error('cluster connection error', errorEvent);
            },
            lazy: {
                enabled: true,
                closeMs: 24 * 3600 * 1000,
            },
        });

        const trpcClient = createTRPCClient<TControlPlaneAppRouter>({
            links: [
                wsLink({
                    client: wsClient,
                }),
            ],
        });

        return {
            trpc: trpcClient,
            get isOpen() {
                return isOpen;
            },
            get ephemeralId() {
                return runId;
            },
        };
    });

    return {
        clients,
    };
}

export type TControlClientsService = {
    controlClients: Awaited<ReturnType<typeof createControlClients>>;
};
