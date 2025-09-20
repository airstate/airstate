import { getDefaultClient, TAirStateClient } from '../client.mjs';
import { TPresenceState } from './types.mjs';
import { TJSONAble } from '../ydocjson.mjs';

export type TSharedPresenceOptions<T extends TJSONAble> = {
    client?: TAirStateClient;
    peerId: string;
    room?: string;
    token?: string | (() => string) | (() => Promise<string>);
    initialState: T;

    validate?: (rawState: any) => T;
};

export type TSharedPresence<T extends TJSONAble = TJSONAble> = {
    readonly peerId: string;

    readonly self: TPresenceState<T>['peers'][string];
    readonly others: TPresenceState<T>['peers'];
    readonly setState: (update: T | ((prev: T) => T)) => void;
    readonly onUpdate: (
        listener: (presenceState: {
            self: TPresenceState<T>['peers'][string];
            others: TPresenceState<T>['peers'];
            stats: TPresenceState<T>['stats'];
        }) => void,
    ) => () => boolean;
    readonly onError: (listener: (error?: any) => void) => () => boolean;

    readonly connected: boolean;
    readonly onConnect: (listener: () => void) => () => boolean;
    readonly onDisconnect: (listener: () => void) => () => boolean;

    readonly started: boolean;
    readonly onStarted: (listener: () => void) => () => boolean;
    readonly onStopped: (listener: () => void) => () => boolean;

    readonly destroy: () => void;
};

export function sharedPresence<T extends TJSONAble>(
    options: TSharedPresenceOptions<T>,
): TSharedPresence<T> {
    const updateListeners = new Set<
        (presenceState: {
            self: TPresenceState<T>['peers'][string];
            others: TPresenceState<T>['peers'];
            stats: TPresenceState<T>['stats'];
            state: TPresenceState<T>;
        }) => void
    >();

    const errorListeners = new Set<(error?: any) => void>();
    const connectListeners = new Set<() => void>();
    const disconnectListeners = new Set<() => void>();
    const startedListeners = new Set<() => void>();
    const stoppedListeners = new Set<() => void>();

    const airState = options.client ?? getDefaultClient();

    const roomKey =
        options.room ??
        (typeof window !== 'undefined'
            ? `${window.location.host}${window.location.pathname}`
            : undefined);

    if (!roomKey) {
        throw new Error(`a roomKey must be set as it could not be inferred`);
    }

    const currentState: TPresenceState<T> = {
        peers: {
            [options.peerId]: {
                peerId: options.peerId,

                state: options.initialState as any,
                lastUpdated: Date.now(),

                connected: true,
                lastConnected: Date.now(),
            },
        },
        stats: {
            totalPeers: 0,
        },
    };

    function notifyListeners() {
        const self = currentState.peers[options.peerId];

        const publicOthers = {
            ...currentState.peers,
        };

        delete publicOthers[options.peerId];

        updateListeners.forEach((listener) => {
            listener({
                self: self,
                stats: currentState.stats,
                others: publicOthers,
                state: currentState,
            });
        });
    }

    function recalculateSummary() {
        const peers = Object.values(currentState.peers);
        currentState.stats.totalPeers = peers.length;
    }

    let sessionId: null | string = null;

    let syncingState = false;
    let scheduledState = false;
    let stateSyncerTimeout = setTimeout(() => {}, 0);
    let stateSyncingFailed = -1;

    async function syncState() {
        const peer = currentState.peers[options.peerId];

        if (syncingState || !sessionId) {
            return;
        }

        syncingState = true;
        scheduledState = false;

        try {
            // TODO: properly implement exponential back-off
            airState.trpc.presence.update.mutate({
                sessionId: sessionId,
                update: {
                    type: 'state',
                    state: peer.state,
                },
            });

            stateSyncingFailed = -1;
        } catch (error) {
            stateSyncingFailed = stateSyncingFailed + 1;
            scheduledState = true;
            stateSyncerTimeout = setTimeout(
                syncState,
                Math.max(1.5 ** stateSyncingFailed * 1_000, 60_000),
            );
        } finally {
            syncingState = false;
        }
    }

    function triggerStateSync(force: boolean = false) {
        if (!scheduledState || force) {
            if (force) {
                clearTimeout(stateSyncerTimeout);
            }

            syncState();
        }
    }

    function triggerInitialSync() {
        const peer = currentState.peers[options.peerId];

        if (peer.state !== undefined) {
            triggerStateSync(true);
        }
    }

    function setState(update: T | ((prev: T) => T)) {
        currentState.peers[options.peerId] = {
            ...currentState.peers[options.peerId],
            state:
                typeof update === 'function'
                    ? update(currentState.peers[options.peerId].state as any)
                    : update,
            lastUpdated: Date.now(),
        };

        delete currentState.peers[options.peerId]['error'];

        triggerStateSync();
        recalculateSummary();
        notifyListeners();
    }

    let isStarted = false;

    const { unsubscribe } = airState.trpc.presence.roomUpdates.subscribe(
        {
            room: roomKey,
        },
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
                    const resolvedToken =
                        typeof options.token === 'function'
                            ? await options.token()
                            : options.token;

                    await airState.trpc.presence.peerInit.mutate({
                        peerId: options.peerId,
                        token: resolvedToken ?? null,
                        sessionId: message.session_id,
                        initialState: options.initialState,
                    });

                    sessionId = message.session_id;
                } else if (message.type === 'init') {
                    const nextPeers = message.state.peers;

                    Object.assign(currentState.peers, nextPeers);
                    Object.assign(currentState.stats, message.state.stats);

                    recalculateSummary();
                    notifyListeners();

                    triggerInitialSync();
                } else if (message.type === 'meta') {
                    currentState.peers[message.peer_id] = {
                        ...currentState.peers[message.peer_id],
                        peerId: message.peer_id,
                        meta: message.meta,
                    };

                    recalculateSummary();
                    notifyListeners();
                } else if (message.type === 'state') {
                    if (options.validate) {
                        try {
                            const nextState = options.validate(message.state);
                            const nextPeer = {
                                ...currentState.peers[message.peer_id],
                                peerId: message.peer_id,
                                state: nextState as any,
                                lastUpdated: message.timestamp,
                            };

                            delete nextPeer['error'];

                            currentState.peers[message.peer_id] = nextPeer;
                        } catch (error) {
                            currentState.peers[message.peer_id] = {
                                ...currentState.peers[message.peer_id],
                                peerId: message.peer_id,
                                error: error,
                                lastUpdated: message.timestamp,
                            };

                            errorListeners.forEach((listener) => {
                                listener(error);
                            });
                        }
                    } else {
                        currentState.peers[message.peer_id] = {
                            ...currentState.peers[message.peer_id],
                            peerId: message.peer_id,
                            state: message.state,
                            lastUpdated: message.timestamp,
                        };
                    }

                    recalculateSummary();
                    notifyListeners();
                } else if (message.type === 'connected') {
                    currentState.peers[message.peer_id] = {
                        ...currentState.peers[message.peer_id],
                        peerId: message.peer_id,
                        connected: true,
                        lastConnected: message.timestamp,
                    };

                    recalculateSummary();
                    notifyListeners();
                } else if (message.type === 'disconnected') {
                    currentState.peers[message.peer_id] = {
                        ...currentState.peers[message.peer_id],
                        peerId: message.peer_id,
                        connected: false,
                        lastDisconnected: message.timestamp,
                    };

                    recalculateSummary();
                    notifyListeners();
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
        get self() {
            return currentState.peers[options.peerId];
        },
        get others() {
            const publicOthers = {
                ...currentState.peers,
            };

            delete publicOthers[options.peerId];

            return publicOthers;
        },
        peerId: options.peerId,
        setState: setState,
        onUpdate: (listener) => {
            updateListeners.add(listener);
            return () => updateListeners.delete(listener);
        },
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
            updateListeners.clear();
            errorListeners.clear();
            connectListeners.clear();
            disconnectListeners.clear();

            unsubscribe();
        },
    };
}
export { TPresenceState };
