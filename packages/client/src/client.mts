import type { TServicePlaneAppRouter } from '@airstate/server';
import { createTRPCClient, createWSClient, TRPCClient, wsLink } from '@trpc/client';
import { nanoid } from 'nanoid';

export type TClientOptions = {
    appKey?: string;
    server?: string;
};

export const defaultOptions: TClientOptions = {
    appKey: undefined,
};

export type TAirStateClient = {
    readonly trpc: TRPCClient<TServicePlaneAppRouter>;
    readonly onOpen: (listener: () => void) => () => boolean;
    readonly onError: (listener: (errorEvent?: Event) => void) => () => boolean;
    readonly onClose: (listener: (cause?: { code?: number }) => void) => () => boolean;
    readonly isOpen: boolean;
};

export function createClient(options?: TClientOptions): TAirStateClient {
    const clientID = (() => {
        const storedClientID = window.localStorage.getItem('clientID');

        if (!storedClientID) {
            const nextClientID = nanoid();
            window.localStorage.setItem('clientID', nextClientID);
            return nextClientID;
        }

        return storedClientID;
    })();

    const openListeners = new Set<() => void>();
    const errorListeners = new Set<(errorEvent?: Event) => void>();
    const closeListeners = new Set<(cause?: { code?: number }) => void>();

    let isOpen = false;

    const wsClient = createWSClient({
        url: options?.server ?? `wss://server.airstate.dev/ws`,
        keepAlive: {
            enabled: true,
            intervalMs: 1_000,
            pongTimeoutMs: 1_000,
        },
        retryDelayMs: (index) => {
            return index ** 2 * 100;
        },
        connectionParams: () => {
            return {
                appKey: options?.appKey ?? defaultOptions.appKey,
                clientID: clientID,
                connectionID: nanoid(),
                pageHostname: window.location.hostname,
            };
        },
        onOpen() {
            openListeners.forEach((listener) => listener());
            isOpen = true;
        },
        onError(errorEvent) {
            errorListeners.forEach((listener) => listener(errorEvent));
        },
        onClose(reason) {
            closeListeners.forEach((listener) => listener(reason));
            isOpen = false;
        },
    });

    const client = createTRPCClient<TServicePlaneAppRouter>({
        links: [
            wsLink<TServicePlaneAppRouter>({
                client: wsClient,
            }),
        ],
    });

    return {
        trpc: client,
        get isOpen() {
            return isOpen;
        },
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

export * as yjs from 'yjs';
