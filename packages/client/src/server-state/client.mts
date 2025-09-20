import { getDefaultClient, TAirStateClient } from '../client.mjs';

export type TServerStateClientOptions = {
    client?: TAirStateClient;
};
export type TServerStateClient = {
    readonly watchedKeys: string[];

    readonly onError: (listener: (error?: any) => void) => () => boolean;

    readonly connected: boolean;
    readonly onConnect: (listener: () => void) => () => boolean;
    readonly onDisconnect: (listener: () => void) => () => boolean;

    readonly started: boolean;
    readonly onStarted: (listener: () => void) => () => boolean;
    readonly onStopped: (listener: () => void) => () => boolean;

    readonly destroy: () => void;

    readonly makeObserver: () => {
        readonly watchedKeySet: Set<string>;

        readonly watch: (keys: string[]) => void;
        readonly unwatch: (keys: string[]) => void;

        readonly onChange: (listener: (key: string, value: any) => void) => () => void;

        readonly destroy: () => void;
    };
};

export function createServerStateClient(
    options?: TServerStateClientOptions,
): TServerStateClient {
    const observerMap: Record<string, Set<(key: string, value: any) => void>> = {};

    const errorListeners = new Set<(error?: any) => void>();
    const connectListeners = new Set<() => void>();
    const disconnectListeners = new Set<() => void>();
    const startedListeners = new Set<() => void>();
    const stoppedListeners = new Set<() => void>();

    const airState = options?.client ?? getDefaultClient();

    let isStarted = false;

    const watchedKeys = new Set<string>();

    const unsyncedKeyAdditions = new Set<string>();
    const unsyncedKeyRemovals = new Set<string>();

    let sessionId: null | string = null;
    let syncingKeys = false;
    let scheduledKeySync = false;
    let keySyncerTimeout = setTimeout(() => {}, 0);
    let keySyncingFailCount = -1;

    async function syncKeys() {
        if (syncingKeys || !sessionId) {
            return;
        }

        syncingKeys = true;
        scheduledKeySync = false;

        try {
            const keysToWatch = [...unsyncedKeyAdditions];
            const keysToUnwatch = [...unsyncedKeyRemovals];

            await airState.trpc.serverState.watchKeys.mutate({
                sessionId: sessionId,
                keys: keysToWatch,
            });

            keysToWatch.forEach((key) => {
                watchedKeys.add(key);
            });

            await airState.trpc.serverState.unwatchKeys.mutate({
                sessionId: sessionId,
                keys: keysToUnwatch,
            });

            keysToUnwatch.forEach((key) => {
                watchedKeys.delete(key);
            });

            keySyncingFailCount = -1;
        } catch (error) {
            keySyncingFailCount = keySyncingFailCount + 1;
            scheduledKeySync = true;
            keySyncerTimeout = setTimeout(
                syncKeys,
                Math.max(1.5 ** keySyncingFailCount * 1_000, 60_000),
            );
        } finally {
            syncingKeys = false;
        }
    }

    function triggerKeySync(force: boolean = false) {
        if (!scheduledKeySync || force) {
            if (force) {
                clearTimeout(keySyncerTimeout);
            }

            keySyncerTimeout = setTimeout(() => {
                syncKeys();
            }, 10);

            scheduledKeySync = true;
        }
    }

    function triggerInitialSync() {
        if (unsyncedKeyAdditions.size || unsyncedKeyRemovals.size) {
            triggerKeySync(true);
        }
    }

    const watchKeys = (keys: string[]) => {
        let hasChanges = false;

        keys.forEach((key) => {
            if (!watchedKeys.has(key)) {
                unsyncedKeyAdditions.add(key);
                unsyncedKeyRemovals.delete(key);

                hasChanges = true;
            }
        });

        if (hasChanges) {
            triggerKeySync();
        }
    };

    const unwatchKeys = (keys: string[]) => {
        let hasChanges = false;

        keys.forEach((key) => {
            if (watchedKeys.has(key)) {
                unsyncedKeyAdditions.delete(key);
                unsyncedKeyRemovals.add(key);

                hasChanges = true;
            }
        });

        if (hasChanges) {
            triggerKeySync();
        }
    };

    const { unsubscribe } = airState.trpc.serverState.serverState.subscribe(
        {},
        {
            onStarted() {
                isStarted = true;

                startedListeners.forEach((listener) => {
                    listener();
                });
            },
            onError(error) {
                errorListeners.forEach((listener) => listener(error));
            },
            onStopped() {
                isStarted = false;

                stoppedListeners.forEach((listener) => {
                    listener();
                });
            },
            onComplete() {
                isStarted = false;

                stoppedListeners.forEach((listener) => {
                    listener();
                });
            },
            async onData(message) {
                if (message.type === 'session-info') {
                    await airState.trpc.serverState.clientInit.mutate({
                        sessionId: message.session_id,
                        token: '',
                    });

                    await airState.trpc.serverState.watchKeys.mutate({
                        sessionId: message.session_id,
                        keys: [...watchedKeys],
                    });

                    sessionId = message.session_id;
                } else if (message.type === 'init') {
                    triggerInitialSync();
                } else if (message.type === 'updates') {
                    message.updates.forEach((update) => {
                        if (update.key in observerMap) {
                            observerMap[update.key].forEach((listener) => {
                                listener(update.key, update.value);
                            });
                        }
                    });
                }
            },
        },
    );

    airState.onConnect(() => {
        connectListeners.forEach((listener) => {
            listener();
        });
    });

    airState.onDisconnect(() => {
        disconnectListeners.forEach((listener) => {
            listener();
        });
    });

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
        onStarted: (listener) => {
            startedListeners.add(listener);
            return () => startedListeners.delete(listener);
        },
        onStopped: (listener) => {
            stoppedListeners.add(listener);
            return () => stoppedListeners.delete(listener);
        },
        get connected() {
            return airState.connected;
        },
        get started() {
            return isStarted;
        },
        destroy() {
            connectListeners.clear();
            disconnectListeners.clear();
            errorListeners.clear();
            connectListeners.clear();
            disconnectListeners.clear();

            unsubscribe();
        },
        get watchedKeys() {
            const resultSet = new Set<string>(watchedKeys);

            unsyncedKeyAdditions.forEach((key) => {
                resultSet.add(key);
            });

            unsyncedKeyRemovals.forEach((key) => {
                resultSet.delete(key);
            });

            return [...resultSet];
        },
        makeObserver() {
            const changeListeners = new Set<(key: string, value: any) => void>();

            const handler = (key: string, value: any) => {
                changeListeners.forEach((listener) => {
                    listener(key, value);
                });
            };

            const watchedKeySet = new Set<string>();

            return {
                get watchedKeySet() {
                    return watchedKeySet;
                },
                watch(keys: string[]) {
                    keys.forEach((key) => {
                        watchedKeySet.add(key);

                        if (!(key in observerMap)) {
                            observerMap[key] = new Set();
                        }

                        observerMap[key].add(handler);
                    });

                    watchKeys(keys);
                },
                unwatch(keys: string[]) {
                    keys.forEach((key) => {
                        watchedKeySet.delete(key);

                        if (key in observerMap) {
                            const observers = observerMap[key];

                            observers.delete(handler);

                            if (observers.size === 0) {
                                delete observerMap[key];
                            }
                        }
                    });

                    unwatchKeys(keys);
                },
                onChange(listener: (key: string, value: any) => void) {
                    changeListeners.add(listener);
                    return () => changeListeners.delete(listener);
                },
                destroy() {
                    watchedKeySet.forEach((key) => {
                        if (key in observerMap) {
                            observerMap[key].delete(handler);

                            if (observerMap[key].size === 0) {
                                delete observerMap[key];
                            }
                        }
                    });

                    changeListeners.clear();
                },
            };
        },
    };
}

export type TAirStateServerStateClient = ReturnType<typeof createServerStateClient>;
