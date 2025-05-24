import { decodeYDocToObject, encodeObjectToYDoc, TJSONAble } from '../ydocjson.mjs';
import * as y from 'yjs';
import { sharedYDoc } from '../shared-ydoc/index.mjs';
import { TAirStateClient } from '../client.mjs';

export type TSharedStateOptions<T extends TJSONAble> = {
    client?: TAirStateClient;
    key: string;
    token?: string | (() => string | Promise<string>);
    initialValue?: T | (() => T);
};
export type TSharedStateReturn<T extends TJSONAble> = {
    readonly update: (update: T | ((previousValue: T) => T)) => void;
    readonly subscribe: (listener: (value: T, origin: any) => void) => () => boolean;
    readonly onSynced: (listener: (value: T) => void) => () => boolean;
    readonly onError: (listener: (error?: Error) => void) => () => boolean;
    readonly onConnect: (listener: () => void) => () => boolean;
    readonly onDisconnect: (listener: () => void) => () => boolean;
    readonly destroy: () => void;
};

export function createSharedState<T extends TJSONAble = any>(
    options: TSharedStateOptions<T>,
): TSharedStateReturn<T> {
    const doc = new y.Doc();

    const undoManager = new y.UndoManager(doc, {
        // the entire year basically, because we want to capture
        // everything until init
        captureTimeout: 3_600 * 24 * 365,
    });

    const resolvedInitialValue =
        typeof options.initialValue === 'function'
            ? options.initialValue()
            : options.initialValue;

    if (resolvedInitialValue) {
        y.transact(doc, () => {
            encodeObjectToYDoc({
                object: {
                    sharedData: resolvedInitialValue,
                },
                doc: doc,
            });
        });
    }

    const updateListeners = new Set<(value: T, origin: any) => void>();
    const syncedListeners = new Set<(value: T) => void>();
    const errorListeners = new Set<(error?: Error) => void>();
    const connectListeners = new Set<() => void>();
    const disconnectListeners = new Set<() => void>();

    const sharedDoc = sharedYDoc({
        client: options.client,
        key: options.key,
        doc: doc,
        token: options.token,
    });

    let hasInitializedOnce = false;
    let needsInitAfterSync = false;

    sharedDoc.onInit((doc, initMeta) => {
        if (
            !hasInitializedOnce &&
            resolvedInitialValue &&
            !initMeta.hasWrittenFirstUpdate
        ) {
            needsInitAfterSync = true;
            hasInitializedOnce = true;

            undoManager.stopCapturing();
            undoManager.undo();
            sharedDoc.clearUpdates();
        }
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
        syncedListeners.forEach((listener) => listener(syncedValue?.sharedData as T));
    });

    doc.on('update', (update, origin) => {
        const newValue = decodeYDocToObject({ doc: doc });

        updateListeners.forEach((listener) =>
            listener(newValue?.sharedData as T, origin),
        );
    });

    sharedDoc.onSynced(() => {
        if (needsInitAfterSync && resolvedInitialValue) {
            needsInitAfterSync = false;

            y.transact(doc, () => {
                encodeObjectToYDoc({
                    object: {
                        sharedData: resolvedInitialValue,
                    },
                    doc: doc,
                });
            });
        }
    });

    const update = (update: T | ((previousValue: T) => T)) => {
        const prevValue = decodeYDocToObject({ doc: doc });
        const newValue =
            typeof update === 'function' ? update(prevValue?.sharedData as T) : update;

        y.transact(doc, () => {
            encodeObjectToYDoc({
                object: {
                    sharedData: newValue,
                },
                doc: doc,
                avoidRemovingKeys: true,
            });
        });
    };

    return {
        update,
        subscribe: (listener: (value: T, origin: any) => void) => {
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
