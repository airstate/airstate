import { decodeYDocToObject, encodeObjectToYDoc, TJSONAble } from '../ydocjson.mjs';
import * as y from 'yjs';
import { sharedYDoc, TSharedYDoc } from '../shared-ydoc/index.mjs';
import { TAirStateClient } from '../client.mjs';

export type TSharedStateOptions<T extends TJSONAble> = {
    client?: TAirStateClient;
    key: string;
    token?: string | (() => string | Promise<string>);
    initialValue?: T | (() => T);
};

export type TSharedStateReturn<T extends TJSONAble> = {
    readonly update: (update: T | ((previousValue: T) => T)) => void;
    readonly onUpdate: (listener: (value: T, origin: any) => void) => () => boolean;
    readonly onSynced: (listener: (value: T) => void) => () => boolean;
    readonly onError: (listener: (error?: Error) => void) => () => boolean;
    readonly onConnect: (listener: () => void) => () => boolean;
    readonly onDisconnect: (listener: () => void) => () => boolean;
    readonly destroy: () => void;
    readonly synced: boolean;
};

export function createSharedState<T extends TJSONAble = any>(
    options: TSharedStateOptions<T>,
): TSharedStateReturn<T> {
    const updateListeners = new Set<(value: T, origin: any) => void>();
    const syncedListeners = new Set<(value: T) => void>();
    const errorListeners = new Set<(error?: Error) => void>();
    const connectListeners = new Set<() => void>();
    const disconnectListeners = new Set<() => void>();

    let usingDoc = new y.Doc();
    let isSynced = false;

    const resolvedInitialValue =
        typeof options.initialValue === 'function'
            ? options.initialValue()
            : options.initialValue;

    function register(doc: y.Doc, sharedDoc: TSharedYDoc) {
        const updateHandler = (update: Uint8Array, origin: any) => {
            const decoded = decodeYDocToObject({ doc: doc });

            updateListeners.forEach((listener) => {
                listener(decoded.data as any, origin);
            });
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

    if (resolvedInitialValue) {
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

    const sharedDoc = sharedYDoc({
        doc: usingDoc,
        key: options.key,
        client: options.client,
        token: options.token,
    });

    const unsubscribeOriginal = register(usingDoc, sharedDoc);
    let unsubscribeNext = () => {};

    sharedDoc.onInit((doc, initMeta) => {
        if (!initMeta.hasWrittenFirstUpdate) {
            sharedDoc.filterUpdates(() => []);

            unsubscribeOriginal();
            usingDoc.destroy();
            sharedDoc.destroy();

            const nextDoc = new y.Doc();

            const nextSharedDoc = sharedYDoc({
                doc: nextDoc,
                key: options.key,
                client: options.client,
                token: options.token,
            });

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
            updateListeners.clear();
            syncedListeners.clear();
            errorListeners.clear();
            connectListeners.clear();
            disconnectListeners.clear();

            unsubscribeNext();
            usingDoc.destroy();
        },
    };
}
