import type { TServicePlaneAppRouter } from '@airstate/server';
import { createTRPCClient, createWSClient, TRPCClient, wsLink } from '@trpc/client';
import { nanoid } from 'nanoid';

export type TClientOptions =
    | {
        appId: string;
    }
    | {
        server: string;
        appId?: string;
    };

const DEFAULT_SERVER = 'wss://server.airstate.dev/ws';
const defaultOptions: TClientOptions = { server: DEFAULT_SERVER };

export type TAirStateClient = {
    readonly trpc: TRPCClient<TServicePlaneAppRouter>;
    readonly onConnect: (listener: () => void) => () => boolean;
    readonly onError: (listener: (errorEvent?: Event) => void) => () => boolean;
    readonly onDisconnect: (
        listener: (cause?: { code?: number }) => void,
    ) => () => boolean;
    readonly connected: boolean;
    readonly destroy: () => void;
};

export function createClient(options?: TClientOptions): TAirStateClient {
    const clientId = (() => {
        const server = options && 'server' in options ? options.server : DEFAULT_SERVER;
        const appId = options?.appId ?? '';

        const clientIdStorageKey = `airstate:client_id:${server}:${appId}`;

        const storedClientId = window.localStorage.getItem(clientIdStorageKey);

        if (!storedClientId) {
            const nextClientId = nanoid();
            window.localStorage.setItem(clientIdStorageKey, nextClientId);
            return nextClientId;
        }

        return storedClientId;
    })();

    const connectListeners = new Set<() => void>();
    const errorListeners = new Set<(errorEvent?: Event) => void>();
    const disconnectListeners = new Set<(cause?: { code?: number }) => void>();

    let isOpen = false;

    const wsClient = createWSClient({
        url: options && 'server' in options ? options.server : DEFAULT_SERVER,
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
                appId: options && 'appId' in options ? options.appId : undefined,
                clientId: clientId,
                connectionId: nanoid(),
                pageHostname: window.location.hostname,
            };
        },
        onOpen() {
            connectListeners.forEach((listener) => listener());
            isOpen = true;
        },
        onError(errorEvent) {
            errorListeners.forEach((listener) => listener(errorEvent));
        },
        onClose(reason) {
            disconnectListeners.forEach((listener) => listener(reason));
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
        get connected() {
            return isOpen;
        },
        onConnect(listener: () => void) {
            connectListeners.add(listener);
            return () => connectListeners.delete(listener);
        },
        onError(listener: (errorEvent?: Event) => void) {
            errorListeners.add(listener);
            return () => errorListeners.delete(listener);
        },
        onDisconnect(listener: (cause?: { code?: number }) => void) {
            disconnectListeners.add(listener);
            return () => disconnectListeners.delete(listener);
        },
        destroy() {
            wsClient.close();

            connectListeners.clear();
            disconnectListeners.clear();
            errorListeners.clear();
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
