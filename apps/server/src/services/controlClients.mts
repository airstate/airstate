import { env } from '../env.mjs';
import { createTRPCClient, createWSClient, wsLink } from '@trpc/client';
import { TControlPlaneAppRouter } from '../api/trpc/control/routers/index.mjs';
import { logger } from '../logger.mjs';

export async function createControlClients() {
    const clusterURLs = env.AIRSTATE_CLUSTER ?? '';

    const clusterURLArray = clusterURLs
        .split(',')
        .map((url) => url.trim())
        .filter((url) => url.length > 0);

    const clients = clusterURLArray.map((url) => {
        let isOpen = false;
        let ephemeralID: string | null = null;

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
                ephemeralID = info.ephemeral_id;
            },
            onClose() {
                isOpen = false;
            },
            onError(errorEvent) {
                logger.error(errorEvent);
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
            get ephemeralID() {
                return ephemeralID;
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
