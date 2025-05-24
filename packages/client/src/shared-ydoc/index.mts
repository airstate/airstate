import * as y from 'yjs';
import { RemoteOrigin } from '../nominal-types.mjs';
import { base64ToUint8Array, uint8ArrayToBase64 } from '../utils.mjs';
import { getDefaultClient, TAirStateClient } from '../client.mjs';

export type TSharedYDocOptions = {
    client?: TAirStateClient;
    key: string;
    doc: y.Doc;
    token?: string | (() => string | Promise<string>);
};
export type TSharedYDocReturn = {
    readonly onError: (listener: (error?: Error) => void) => () => boolean;
    readonly onConnect: (listener: () => void) => () => boolean;
    readonly onDisconnect: (listener: () => void) => () => boolean;
    readonly onSynced: (listener: (doc: y.Doc) => void) => () => boolean;
    readonly onInit: (
        listener: (doc: y.Doc, initMeta: { hasWrittenFirstUpdate: boolean }) => void,
    ) => () => boolean;
    readonly unsubscribe: () => void;
};

export function sharedYDoc(options: TSharedYDocOptions): TSharedYDocReturn {
    const airState = options.client ?? getDefaultClient();

    let ready = false;

    const errorListeners = new Set<(error?: Error) => void>();
    const connectListeners = new Set<() => void>();
    const disconnectListeners = new Set<() => void>();
    const syncedListeners = new Set<(doc: y.Doc) => void>();
    const initListeners = new Set<
        (doc: y.Doc, initMeta: { hasWrittenFirstUpdate: boolean }) => void
    >();

    const cleanupOnOpen = airState.onOpen(() => {
        connectListeners.forEach((listener) => listener());
    });

    const cleanupOnClose = airState.onClose(() => {
        disconnectListeners.forEach((listener) => listener());
    });

    let updates: string[] = [];
    let scheduled = false;
    let sessionID: null | string = null;
    let syncerTimeout = setTimeout(() => {}, 0);
    let failed = -1;
    let syncing = false;

    async function syncUpdates() {
        if (syncing || !updates.length || !sessionID) {
            return;
        }

        syncing = true;
        scheduled = false;

        try {
            const syncedUpdateCount = updates.length;

            await airState.trpc.yjs.docUpdate.mutate({
                key: options.key,
                sessionID: sessionID,
                encodedUpdates: updates.slice(0, syncedUpdateCount),
            });

            updates = updates.slice(syncedUpdateCount);

            failed = -1;
            syncerTimeout = setTimeout(syncUpdates, 0);
        } catch (error) {
            failed = failed + 1;
            scheduled = true;
            syncerTimeout = setTimeout(
                syncUpdates,
                Math.max(1.5 ** failed * 1_000, 60_000),
            );
        } finally {
            syncing = false;
        }
    }

    function triggerSync(force: boolean = false) {
        if (!scheduled || force) {
            clearTimeout(syncerTimeout);
            setTimeout(syncUpdates, 0);
        }
    }

    options.doc.on('updateV2', async (update, origin) => {
        if (!(origin instanceof RemoteOrigin)) {
            updates.push(uint8ArrayToBase64(update));
            triggerSync();
        }
    });

    const subscription = airState.trpc.yjs.docUpdates.subscribe(
        {
            key: options.key,
        },
        {
            onError(error) {
                errorListeners.forEach((listener) => listener(error));
            },
            async onData(message) {
                if (message.type === 'session-id') {
                    sessionID = message.id;

                    let token: null | string = null;

                    if (typeof options.token === 'function') {
                        const returned = options.token();

                        if (returned instanceof Promise) {
                            token = await returned;
                        } else {
                            token = returned;
                        }
                    } else {
                        token = options.token ?? null;
                    }

                    const { hasWrittenFirstUpdate } =
                        await airState.trpc.yjs.docToken.mutate({
                            sessionID: sessionID,
                            token: token,
                            firstUpdate: uint8ArrayToBase64(
                                y.encodeStateAsUpdateV2(options.doc),
                            ),
                        });

                    initListeners.forEach((listener) =>
                        listener(options.doc, {
                            hasWrittenFirstUpdate: hasWrittenFirstUpdate,
                        }),
                    );
                } else if (message.type === 'sync') {
                    y.transact(
                        options.doc,
                        () => {
                            message.updates.forEach((update) => {
                                const binaryUpdate = base64ToUint8Array(update);
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
                        triggerSync(true);
                    }
                } else if (message.type === 'update') {
                    if (ready) {
                        y.transact(
                            options.doc,
                            () => {
                                message.updates.forEach((update) => {
                                    const binaryUpdate = base64ToUint8Array(update);

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
        initListeners.clear();
    };

    return {
        onError: (listener) => {
            errorListeners.add(listener);
            return () => errorListeners.delete(listener);
        },
        onConnect: (listener) => {
            connectListeners.add(listener);
            return () => connectListeners.delete(listener);
        },
        onDisconnect: (listener) => {
            disconnectListeners.add(listener);
            return () => disconnectListeners.delete(listener);
        },
        onInit: (listener) => {
            initListeners.add(listener);
            return () => initListeners.delete(listener);
        },
        onSynced: (listener) => {
            syncedListeners.add(listener);
            return () => syncedListeners.delete(listener);
        },
        unsubscribe,
    };
}
