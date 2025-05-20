import type { TServicePlaneAppRouter } from '@airstate/server';
import { createTRPCClient, createWSClient, TRPCClient, wsLink } from '@trpc/client';
import * as y from 'yjs';
import { nanoid } from 'nanoid';
import { TJSONAbleObject, encodeObjectToYDoc, decodeYDocToObject } from './ydocjson.mjs';

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
            intervalMs: 1_000,
            pongTimeoutMs: 1_000,
        },
        retryDelayMs: (index) => {
            console.log('retryDelayMs: ', index);
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
};

export type TSharedYDocReturn = {
    readonly onError: (listener: (error?: Error) => void) => () => boolean;
    readonly onConnect: (listener: () => void) => () => boolean;
    readonly onDisconnect: (listener: () => void) => () => boolean;
    readonly onSynced: (listener: (doc: y.Doc) => void) => () => boolean;
    readonly unsubscribe: () => void;
};

export class RemoteOrigin {
    constructor(
        public readonly reason: 'sync' | 'update',
        public readonly client?: string,
    ) {}
}

export function sharedYDoc(options: TSharedYDocOptions): TSharedYDocReturn {
    const sessionID = nanoid();

    const airState = options.client ?? getDefaultClient();
    let ready = false;

    const errorListeners = new Set<(error?: Error) => void>();
    const connectListeners = new Set<() => void>();
    const disconnectListeners = new Set<() => void>();
    const syncedListeners = new Set<(doc: y.Doc) => void>();

    if (airState.isOpen) {
        connectListeners.forEach((listener) => listener());
    } else {
        disconnectListeners.forEach((listener) => listener());
    }

    const cleanupOnOpen = airState.onOpen(() => {
        connectListeners.forEach((listener) => listener());
    });

    const cleanupOnClose = airState.onClose(() => {
        disconnectListeners.forEach((listener) => listener());
    });

    options.doc.on('updateV2', async (update, origin) => {
        console.log('origin inner', origin);
        if (!(origin instanceof RemoteOrigin)) {
            // let token: null | string = null;
            //
            // if (typeof options.token === 'function') {
            //     const returned = options.token();
            //
            //     if (returned instanceof Promise) {
            //         token = await returned;
            //     } else {
            //         token = returned;
            //     }
            // } else {
            //     token = options.token;
            // }

            await airState.trpc.yjs.docUpdate.mutate({
                key: options.key,
                sessionID: sessionID,
                encodedUpdates: [Uint8ArrayToBase64(update)],
                // token: token,
            });
        }
    });

    const subscription = airState.trpc.yjs.docUpdates.subscribe(
        {
            key: options.key,
            sessionID: sessionID,
        },
        {
            onStarted() {
                console.log('onStarted');
            },
            onError(error) {
                errorListeners.forEach((listener) => listener(error));
            },
            onData(message) {
                if (message.type === 'sync') {
                    y.transact(
                        options.doc,
                        () => {
                            message.updates.forEach((update) => {
                                const binaryUpdate = Base64ToUint8Array(update);
                                y.applyUpdateV2(
                                    options.doc,
                                    binaryUpdate,
                                    new RemoteOrigin('sync'),
                                );
                            });
                        },
                        new RemoteOrigin('sync'),
                    );

                    if (message.final) {
                        ready = true;
                        syncedListeners.forEach((listener) => listener(options.doc));
                    }
                } else if (message.type === 'update') {
                    if (ready) {
                        y.transact(
                            options.doc,
                            () => {
                                message.updates.forEach((update) => {
                                    const binaryUpdate = Base64ToUint8Array(update);
                                    y.applyUpdateV2(
                                        options.doc,
                                        binaryUpdate,
                                        new RemoteOrigin('update', message.client),
                                    );
                                });
                            },
                            new RemoteOrigin('update', message.client),
                        );
                    } else {
                        console.warn(
                            'the server has sent updates before sync completion',
                        );
                    }
                }
            },
        },
    );

    const unsubscribe = () => {
        cleanupOnOpen();
        cleanupOnClose();
        subscription.unsubscribe();
        errorListeners.clear();
        connectListeners.clear();
        disconnectListeners.clear();
        syncedListeners.clear();
    };

    return {
        onError: (listener: (error?: Error) => void) => {
            errorListeners.add(listener);
            return () => errorListeners.delete(listener);
        },
        onConnect: (listener: () => void) => {
            connectListeners.add(listener);
            return () => connectListeners.delete(listener);
        },
        onDisconnect: (listener: () => void) => {
            disconnectListeners.add(listener);
            return () => disconnectListeners.delete(listener);
        },
        onSynced: (listener: (doc: y.Doc) => void) => {
            syncedListeners.add(listener);
            return () => syncedListeners.delete(listener);
        },
        unsubscribe,
    };
}

export type TSharedJSONOptions<T> = {
    client?: TAirStateClient;
    key: string;
    token?: string;
    initialValue?: T;
};

export type TSharedJSONReturn<T extends TJSONAbleObject> = {
    readonly update: (update: T | ((previousValue: T) => T)) => void;
    readonly onUpdate: (listener: (value: T) => void) => () => boolean;
    readonly onSynced: (listener: (value: T) => void) => () => boolean;
    readonly onError: (listener: (error?: Error) => void) => () => boolean;
    readonly onConnect: (listener: () => void) => () => boolean;
    readonly onDisconnect: (listener: () => void) => () => boolean;
    readonly destroy: () => void;
};

export function shareJSONObject<T extends TJSONAbleObject = any>(
    options: TSharedJSONOptions<T>,
): TSharedJSONReturn<T> {
    const doc = new y.Doc();

    const updateListeners = new Set<(value: T) => void>();
    const syncedListeners = new Set<(value: T) => void>();
    const errorListeners = new Set<(error?: Error) => void>();
    const connectListeners = new Set<() => void>();
    const disconnectListeners = new Set<() => void>();

    if (options.initialValue) {
        encodeObjectToYDoc({ object: options.initialValue, doc: doc });
    }

    const sharedDoc = sharedYDoc({
        client: options.client,
        key: options.key,
        doc: doc,
        token: options.token,
    });

    const errorUnsubscribe = sharedDoc.onError((error) => {
        errorListeners.forEach((listener) => listener(error));
    });

    const connectUnsubscribe = sharedDoc.onConnect(() => {
        connectListeners.forEach((listener) => listener());
    });

    const disconnectUnsubscribe = sharedDoc.onDisconnect(() => {
        disconnectListeners.forEach((listener) => listener());
    });

    const syncedUnsubscribe = sharedDoc.onSynced((syncedDoc) => {
        const syncedValue = decodeYDocToObject({ doc: syncedDoc });

        syncedListeners.forEach((listener) => listener(syncedValue as T));
    });

    doc.on('updateV2', (update, origin) => {
        console.log('origin type', origin);
        if (origin instanceof RemoteOrigin) {
            const newValue = decodeYDocToObject({ doc: doc });
            updateListeners.forEach((listener) => listener(newValue as T));
        }
    });

    const update = (update: T | ((previousValue: T) => T)) => {
        const prevValue = decodeYDocToObject({ doc: doc });
        const newValue = typeof update === 'function' ? update(prevValue as T) : update;

        encodeObjectToYDoc({
            object: newValue,
            doc: doc,
        });
    };

    return {
        update,
        onUpdate: (listener: (value: T) => void) => {
            updateListeners.add(listener);
            return () => updateListeners.delete(listener);
        },
        onSynced: (listener: (value: T) => void) => {
            syncedListeners.add(listener);
            return () => syncedListeners.delete(listener);
        },
        onError: (listener: (error?: Error) => void) => {
            errorListeners.add(listener);
            return () => errorListeners.delete(listener);
        },
        onConnect: (listener: () => void) => {
            connectListeners.add(listener);
            return () => connectListeners.delete(listener);
        },
        onDisconnect: (listener: () => void) => {
            disconnectListeners.add(listener);
            return () => disconnectListeners.delete(listener);
        },
        destroy: () => {
            sharedDoc.unsubscribe();
            updateListeners.clear();
            syncedListeners.clear();
            errorListeners.clear();
            connectListeners.clear();
            disconnectListeners.clear();
            doc.destroy();
        },
    };
}

export * as yjs from 'yjs';
