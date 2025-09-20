import { decodeYDocToObject, encodeObjectToYDoc, TJSONAble } from '../ydocjson.mjs';
import * as y from 'yjs';
import { sharedYDoc, TSharedYDoc } from '../shared-ydoc/index.mjs';
import { TAirStateClient } from '../client.mjs';

export type TSharedStateOptions<T extends TJSONAble> = {
    client?: TAirStateClient;

    /**
     * @deprecated prefer `channel` instead
     */
    key?: string;

    channel?: string;

    token?: string | (() => string | Promise<string>);
    initialValue?: T | (() => T);

    validate?: (rawState: any) => T;
};

export type TSharedState<T extends TJSONAble> = {
    readonly update: (update: T | ((previousValue: T) => T)) => void;
    readonly onUpdate: (listener: (value: T, origin: any) => void) => () => boolean;

    readonly onSynced: (listener: (value: T) => void) => () => boolean;

    readonly onError: (listener: (error?: any) => void) => () => boolean;

    readonly onConnect: (listener: () => void) => () => boolean;
    readonly onDisconnect: (listener: () => void) => () => boolean;

    readonly onStarted: (listener: () => void) => () => boolean;
    readonly onStopped: (listener: () => void) => () => boolean;

    readonly destroy: () => void;

    readonly synced: boolean;
    readonly connected: boolean;
    readonly started: boolean;
};

export function sharedState<T extends TJSONAble = any>(
    options?: TSharedStateOptions<T>,
): TSharedState<T> {
    const documentId = options?.channel ?? options?.key;

    const updateListeners = new Set<(value: T, origin: any) => void>();
    const syncedListeners = new Set<(value: T) => void>();
    const errorListeners = new Set<(error?: any) => void>();
    const connectListeners = new Set<() => void>();
    const disconnectListeners = new Set<() => void>();

    const startListeners = new Set<() => void>();
    const stopListeners = new Set<() => void>();

    let usingDoc = new y.Doc();
    (usingDoc as any).since = 'original';

    let isSynced = false;

    const resolvedInitialValue =
        typeof options?.initialValue === 'function'
            ? options.initialValue()
            : options?.initialValue;

    function register(doc: y.Doc, sharedDoc: TSharedYDoc) {
        const updateHandler = (update: Uint8Array, origin: any) => {
            const decoded = decodeYDocToObject({ doc: doc });

            if (options?.validate) {
                const decodedData = decoded.data;

                try {
                    const nextState = options.validate(decodedData);

                    updateListeners.forEach((listener) => {
                        listener(nextState, origin);
                    });
                } catch (error) {
                    errorListeners.forEach((listener) => {
                        listener(error);
                    });
                }
            } else {
                updateListeners.forEach((listener) => {
                    listener(decoded.data as any, origin);
                });
            }
        };

        doc.on('update', updateHandler);

        const cleanupOnConnect = sharedDoc.onConnect(() => {
            connectListeners.forEach((listener) => listener());
        });

        const cleanupOnDisconnect = sharedDoc.onDisconnect(() => {
            disconnectListeners.forEach((listener) => listener());
        });

        const cleanupOnError = sharedDoc.onError((error) => {
            errorListeners.forEach((listener) => listener(error));
        });

        const cleanupOnSynced = sharedDoc.onSynced((doc) => {
            isSynced = true;

            const decoded = decodeYDocToObject({ doc: doc });

            syncedListeners.forEach((listener) => {
                listener(decoded.data as any);
            });
        });

        return () => {
            cleanupOnConnect();
            cleanupOnDisconnect();
            cleanupOnError();
            cleanupOnSynced();

            doc.off('update', updateHandler);
        };
    }

    if (resolvedInitialValue !== undefined) {
        y.transact(
            usingDoc,
            () => {
                encodeObjectToYDoc({
                    doc: usingDoc,
                    object: {
                        data: resolvedInitialValue,
                    },
                });
            },
            'initialState',
        );
    }

    const sharedDocClientInstance = sharedYDoc({
        doc: usingDoc,

        documentId: documentId,
        client: options?.client,
        token: options?.token,
    });

    let usingInstance = sharedDocClientInstance;

    const unsubscribeOriginal = register(usingDoc, sharedDocClientInstance);
    let unsubscribeNext = () => {};

    sharedDocClientInstance.onInit((doc, initMeta) => {
        if (!initMeta.hasWrittenFirstUpdate) {
            sharedDocClientInstance.filterUpdates(() => []);

            unsubscribeOriginal();
            usingDoc.destroy();
            sharedDocClientInstance.destroy();

            const nextDoc = new y.Doc();

            const nextSharedDoc = sharedYDoc({
                doc: nextDoc,
                documentId: documentId,
                client: options?.client,
                token: options?.token,
            });

            usingInstance = nextSharedDoc;

            unsubscribeNext = register(nextDoc, nextSharedDoc);
            usingDoc = nextDoc;
        }
    });

    return {
        get synced() {
            return isSynced;
        },
        update: (update) => {
            if (!isSynced) {
                console.warn(
                    'the shared state is not synced yet, this update may be lost',
                );
            }

            const nextValue =
                update instanceof Function
                    ? update(
                          (decodeYDocToObject({
                              doc: usingDoc,
                          })?.data ?? resolvedInitialValue) as any,
                      )
                    : update;

            y.transact(usingDoc, () => {
                encodeObjectToYDoc({
                    doc: usingDoc,
                    object: {
                        data: nextValue,
                    },
                });
            });
        },
        onUpdate: (listener: (value: T, origin: any) => void) => {
            updateListeners.add(listener);
            return () => updateListeners.delete(listener);
        },
        onSynced: (listener: (value: T) => void) => {
            syncedListeners.add(listener);
            return () => syncedListeners.delete(listener);
        },
        onError: (listener: (error?: any) => void) => {
            errorListeners.add(listener);
            return () => errorListeners.delete(listener);
        },
        get connected() {
            return usingInstance.connected;
        },
        get started() {
            return usingInstance.started;
        },
        onStarted(listener) {
            startListeners.add(listener);
            return () => startListeners.delete(listener);
        },
        onStopped(listener) {
            stopListeners.add(listener);
            return () => stopListeners.delete(listener);
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
            updateListeners.clear();
            syncedListeners.clear();
            errorListeners.clear();

            connectListeners.clear();
            disconnectListeners.clear();

            startListeners.clear();
            stopListeners.clear();

            unsubscribeNext();
            usingDoc.destroy();
        },
    };
}
