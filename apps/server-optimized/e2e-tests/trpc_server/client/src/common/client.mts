import { createTRPCClient, createWSClient, wsLink } from '@trpc/client';
import type { TRouter } from './types.mjs';

const wsClient = createWSClient({
    url: 'ws://localhost:11001/trpc',
});

export async function closeClient() {
    await wsClient.close();
}

export const trpcClient = createTRPCClient<TRouter>({
    links: [wsLink<TRouter>({ client: wsClient })],
});
