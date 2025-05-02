import type { TServicePlaneAppRouter } from '@airstate/server';
import { createTRPCClient, createWSClient, TRPCClient, wsLink } from '@trpc/client';
import * as y from 'yjs';
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
    const openListeners = new Set<() => void>();
    const errorListeners = new Set<(errorEvent?: Event) => void>();
    const closeListeners = new Set<(cause?: { code?: number }) => void>();

    let isOpen = false;

    const wsClient = createWSClient({
        url: options?.server ?? `wss://socket.airstate.dev`,
        keepAlive: {
            enabled: true,
            intervalMs: 5_000,
            pongTimeoutMs: 2_500,
        },
        retryDelayMs: (index) => {
            return index ** 2 * 100;
        },
        connectionParams: {
            appKey: options?.appKey ?? defaultOptions.appKey,
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

export function Uint8ArrayToBase64(array: Uint8Array) {
    return btoa(String.fromCharCode.apply(null, Array.from(array)));
}

export function Base64ToUint8Array(base64: string) {
    const binaryString = atob(base64);

    const len = binaryString.length;
    const uint8Array = new Uint8Array(len);

    for (let i = 0; i < len; i++) {
        uint8Array[i] = binaryString.charCodeAt(i);
    }

    return uint8Array;
}

export type TSharedYDocOptions = {
    client?: TAirStateClient;

    key: string;
    doc: y.Doc;

    token?: string;

    onError?: (error?: Error) => void;
    onConnect?: () => void;
    onDisconnect?: () => void;
    onSynced?: (doc: y.Doc) => void;
};

export class RemoteOrigin {
    constructor(
        public readonly reason: 'sync' | 'update',
        public readonly client?: string,
    ) {}
}

export function shareYDoc(options: TSharedYDocOptions) {
    const sessionID = nanoid();

    const airState = options.client ?? getDefaultClient();
    let ready = false;

    if (airState.isOpen) {
        options.onConnect?.();
    } else {
        options.onDisconnect?.();
    }

    const cleanupOnOpen = airState.onOpen(() => options.onConnect?.());
    const cleanupOnClose = airState.onClose(() => options.onDisconnect?.());

    options.doc.on('updateV2', async (update, origin) => {
        if (!(origin instanceof RemoteOrigin)) {
            await airState.trpc.yjs.docUpdate.mutate({
                key: options.key,
                sessionID: sessionID,
                encodedUpdates: [Uint8ArrayToBase64(update)],
            });
        }
    });

    const subscription = airState.trpc.yjs.docUpdates.subscribe(
        {
            key: options.key,
            sessionID: sessionID,
        },
        {
            onError(error) {
                options.onError?.(error);
            },
            onData(message) {
                if (message.type === 'sync') {
                    y.transact(options.doc, () => {
                        message.updates.forEach((update) => {
                            const binaryUpdate = Base64ToUint8Array(update);

                            y.applyUpdateV2(
                                options.doc,
                                binaryUpdate,
                                new RemoteOrigin('sync'),
                            );
                        });
                    });

                    if (message.final) {
                        ready = true;
                        options.onSynced?.(options.doc);
                    }
                } else if (message.type === 'update') {
                    if (ready) {
                        y.transact(options.doc, () => {
                            message.updates.forEach((update) => {
                                const binaryUpdate = Base64ToUint8Array(update);

                                y.applyUpdateV2(
                                    options.doc,
                                    binaryUpdate,
                                    new RemoteOrigin('update', message.client),
                                );
                            });
                        });
                    } else {
                        console.warn(
                            'the server has sent updates before sync completion',
                        );
                    }
                }
            },
        },
    );

    return () => {
        cleanupOnOpen();
        cleanupOnClose();

        subscription.unsubscribe();
    };
}

export * as yjs from 'yjs';
