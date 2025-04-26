import type { TAppRouter } from '@airstate/server';
import { createTRPCClient, createWSClient, wsLink } from '@trpc/client';

export type TClientOptions = {
    appKey?: string;
};

export const defaultOptions: TClientOptions = {
    appKey: undefined,
};

export function createClient(options?: TClientOptions): {
    client: ReturnType<typeof createTRPCClient<TAppRouter>>;
    onOpen: (listener: () => void) => () => boolean;
    onError: (listener: (errorEvent?: Event) => void) => () => boolean;
    onClose: (listener: (cause?: { code?: number }) => void) => () => boolean;
} {
    const openListeners = new Set<() => void>();
    const errorListeners = new Set<(errorEvent?: Event) => void>();
    const closeListeners = new Set<(cause?: { code?: number }) => void>();

    const wsClient = createWSClient({
        url: `ws://socket.airstate.dev`,
        keepAlive: {
            enabled: true,
            intervalMs: 5_000,
            pongTimeoutMs: 2_500,
        },
        retryDelayMs: (index) => {
            return index ** 2;
        },
        connectionParams: {
            appKey: options?.appKey ?? defaultOptions.appKey,
        },
        onOpen() {
            openListeners.forEach((listener) => listener());
        },
        onError(errorEvent) {
            errorListeners.forEach((listener) => listener(errorEvent));
        },
        onClose(reason) {
            closeListeners.forEach((listener) => listener(reason));
        },
    });

    const client = createTRPCClient<TAppRouter>({
        links: [
            wsLink<TAppRouter>({
                client: wsClient,
            }),
        ],
    });

    return {
        client: client,
        onOpen(listener: () => void) {
            openListeners.add(listener);
            return () => openListeners.delete(listener);
        },
        onError(listener: (errorEvent?: Event) => void) {
            errorListeners.add(listener);
            return () => errorListeners.delete(listener);
        },
        onClose(listener: (cause?: { code?: number }) => void) {
            closeListeners.add(listener);
            return () => closeListeners.delete(listener);
        },
    };
}

export function configure(options: TClientOptions) {
    Object.assign(defaultOptions, options);
}

let defaultClient: ReturnType<typeof createClient>;

export function getDefaultClient() {
    if (!defaultClient) {
        defaultClient = createClient(defaultOptions);
    }

    return defaultClient;
}
