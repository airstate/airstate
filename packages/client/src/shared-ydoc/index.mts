import * as y from 'yjs';
import { AirStateInitialStateUndoManager, RemoteOrigin } from '../nominal-types.mjs';
import { base64ToUint8Array, uint8ArrayToBase64 } from '../utils.mjs';
import { getDefaultClient, TAirStateClient } from '../client.mjs';

export type TSharedYDocOptions = {
    client?: TAirStateClient;
    documentId?: string;
    doc: y.Doc;
    token?: string | (() => string | Promise<string>);
};

export type TSharedYDoc = {
    readonly onError: (listener: (error?: Error) => void) => () => boolean;

    readonly connected: boolean;
    readonly started: boolean;

    readonly onConnect: (listener: () => void) => () => boolean;
    readonly onDisconnect: (listener: () => void) => () => boolean;

    readonly onStarted: (listener: () => void) => () => boolean;
    readonly onStopped: (listener: () => void) => () => boolean;

    readonly onSynced: (listener: (doc: y.Doc) => void) => () => boolean;
    readonly onInit: (
        listener: (doc: y.Doc, initMeta: { hasWrittenFirstUpdate: boolean }) => void,
    ) => () => boolean;
    readonly destroy: () => void;
    readonly filterUpdates: (
        filterFunc: (updates: [string, any][]) => [string, any][],
    ) => void;
};

export function sharedYDoc(options: TSharedYDocOptions): TSharedYDoc {
    const airState = options.client ?? getDefaultClient();

    const documentId =
        options.documentId ??
        (typeof window !== 'undefined'
            ? `${window.location.host}${window.location.pathname}`
            : undefined);

    if (typeof documentId === 'undefined') {
        throw new Error('you must specify a key property as a key could not be inferred');
    }

    let ready = false;

    const errorListeners = new Set<(error?: Error) => void>();

    const connectListeners = new Set<() => void>();
    const disconnectListeners = new Set<() => void>();

    const startListeners = new Set<() => void>();
    const stopListeners = new Set<() => void>();

    const syncedListeners = new Set<(doc: y.Doc) => void>();

    const initListeners = new Set<
        (doc: y.Doc, initMeta: { hasWrittenFirstUpdate: boolean }) => void
    >();

    const cleanupOnOpen = airState.onConnect(() => {
        connectListeners.forEach((listener) => listener());
    });

    const cleanupOnClose = airState.onDisconnect(() => {
        disconnectListeners.forEach((listener) => listener());
    });

    let sessionId: null | string = null;

    let updates: [string, any][] = [];
    let scheduled = false;
    let syncerTimeout = setTimeout(() => {}, 0);
    let failed = -1;
    let syncing = false;

    async function syncUpdates() {
        if (syncing || !updates.length || !sessionId) {
            return;
        }

        syncing = true;
        scheduled = false;

        try {
            const syncedUpdateCount = updates.length;

            const updatesToSync = updates
                .slice(0, syncedUpdateCount)
                .filter(
                    ([update, origin]) =>
                        !(origin instanceof AirStateInitialStateUndoManager),
                );

            airState.trpc.yjs.docUpdate.mutate({
                sessionId: sessionId,
                encodedUpdates: updatesToSync.map(([update, origin]) => update),
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
            updates.push([uint8ArrayToBase64(update), origin]);
            triggerSync();
        }
    });

    // TODO: move this log subscription out of here and into something more global
    const logSubscription = airState.trpc.clientLogsSubscriptionProcedure.subscribe(
        undefined,
        {
            onData(message) {
                if (message.level === 'debug') {
                    console.debug(...message.logs);
                } else if (message.level === 'info') {
                    console.info(...message.logs);
                } else if (message.level === 'warn') {
                    console.warn(...message.logs);
                } else if (message.level === 'error') {
                    console.error(...message.logs);
                }
            },
        },
    );

    let isStarted = false;

    const subscription = airState.trpc.yjs.docUpdates.subscribe(
        {
            documentId: documentId,
        },
        {
            onError(error) {
                errorListeners.forEach((listener) => listener(error));
            },
            onStarted() {
                isStarted = true;
                startListeners.forEach((listener) => listener());
            },
            onStopped() {
                isStarted = false;
                stopListeners.forEach((listener) => listener());
            },
            async onData(message) {
                if (message.type === 'session-info') {
                    sessionId = message.session_id;

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
                        await airState.trpc.yjs.docInit.mutate({
                            sessionId: sessionId,
                            token: token,
                            initialState: uint8ArrayToBase64(
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

    const destroy = () => {
        cleanupOnOpen();
        cleanupOnClose();

        subscription.unsubscribe();
        logSubscription.unsubscribe();

        errorListeners.clear();

        connectListeners.clear();
        disconnectListeners.clear();

        syncedListeners.clear();

        initListeners.clear();

        startListeners.clear();
        stopListeners.clear();
    };

    return {
        onError: (listener) => {
            errorListeners.add(listener);
            return () => errorListeners.delete(listener);
        },
        get connected() {
            return airState.connected;
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
        get started() {
            return isStarted;
        },
        onStarted(listener) {
            startListeners.add(listener);
            return () => startListeners.delete(listener);
        },
        onStopped(listener) {
            stopListeners.add(listener);
            return () => stopListeners.delete(listener);
        },
        destroy: destroy,
        filterUpdates: (filterFunc) => {
            updates = filterFunc(updates);
        },
    };
}
