import { getDefaultClient, TAirStateClient } from '../client.mjs';
import { TPresenceState } from '@airstate/server';

export type TSharedPresenceOptions<T> = {
    client?: TAirStateClient;
    peerKey: string;
    roomKey?: string;
    token?: string | (() => string) | (() => Promise<string>);
    initialDynamicState?: T;
};

export type TSharedPresence<T extends Record<string, any> = Record<string, any>> = {
    readonly self: TPresenceState<T>['peers'][string];
    readonly others: TPresenceState<T>['peers'];
    readonly updateDynamicState: (update: T | ((prev: T) => T)) => void;
    readonly updateFocusState: (isFocused: boolean) => void;
    readonly onUpdate: (listener: (state: TPresenceState<T>) => void) => () => boolean;
    readonly onError: (listener: (error?: Error) => void) => () => boolean;
    readonly onConnect: (listener: () => void) => () => boolean;
    readonly onDisconnect: (listener: () => void) => () => boolean;
};

export function sharedPresence<T extends Record<string, any>>(
    options: TSharedPresenceOptions<T>,
): TSharedPresence<T> {
    const updateListeners = new Set<(state: TPresenceState<T>) => void>();
    const errorListeners = new Set<(error?: Error) => void>();
    const connectListeners = new Set<() => void>();
    const disconnectListeners = new Set<() => void>();

    const airState = options.client ?? getDefaultClient();

    const roomKey =
        (options.roomKey ?? typeof window !== 'undefined')
            ? `${window.location.host}${window.location.pathname}`
            : undefined;

    if (!roomKey) {
        throw new Error(`a roomKey must be set as it could not be inferred`);
    }

    const currentState: TPresenceState<T> = {
        peers: {
            [options.peerKey]: {
                client_key: options.peerKey,
            },
        },
        summary: {
            totalPeers: 0,
            focusedPeers: 0,
        },
    };

    if (options.initialDynamicState) {
        currentState.peers[options.peerKey] = {
            ...currentState.peers[options.peerKey],
            dynamicState: {
                state: options.initialDynamicState,
                lastUpdateTimestamp: Date.now(),
            },
        };
    }

    function notifyListeners() {
        updateListeners.forEach((listener) => listener(currentState));
    }

    function recalculateSummary() {
        const peers = Object.values(currentState.peers);
        let focusedPeerCount = 0;

        for (const peer of peers) {
            if (peer.focusState?.isFocused) {
                focusedPeerCount += 1;
            }
        }

        currentState.summary.totalPeers = peers.length;
        currentState.summary.focusedPeers = focusedPeerCount;
    }

    let sessionID: null | string = null;

    let syncingDynamicState = false;
    let scheduledDynamicState = false;
    let dynamicStateSyncerTimeout = setTimeout(() => {}, 0);
    let dynamicStateSyncingFailed = -1;

    let syncingFocusState = false;
    let scheduledFocusState = false;
    let focusStateSyncerTimeout = setTimeout(() => {}, 0);
    let focusStateSyncingFailed = -1;

    async function syncDynamicState() {
        if (syncingDynamicState || !sessionID) {
            return;
        }

        syncingDynamicState = true;
        scheduledDynamicState = false;

        try {
            await airState.trpc.presence.update.mutate({
                sessionID: sessionID,
                update: {
                    type: 'dynamic-update',
                    state: currentState.peers[options.peerKey].dynamicState?.state ?? {},
                },
            });

            dynamicStateSyncingFailed = -1;
        } catch (error) {
            dynamicStateSyncingFailed = dynamicStateSyncingFailed + 1;
            scheduledDynamicState = true;
            dynamicStateSyncerTimeout = setTimeout(
                syncDynamicState,
                Math.max(1.5 ** dynamicStateSyncingFailed * 1_000, 60_000),
            );
        } finally {
            syncingDynamicState = false;
        }
    }

    async function syncFocusState() {
        if (syncingFocusState || !sessionID) {
            return;
        }

        syncingFocusState = true;
        scheduledFocusState = false;

        try {
            const self = currentState.peers[options.peerKey];

            if ('focusState' in self && self.focusState) {
                await airState.trpc.presence.update.mutate({
                    sessionID: sessionID,
                    update: {
                        type: 'focus-update',
                        isFocused: self.focusState.isFocused,
                    },
                });
            }

            focusStateSyncingFailed = -1;
        } catch (error) {
            focusStateSyncingFailed = focusStateSyncingFailed + 1;
            scheduledFocusState = true;
            focusStateSyncerTimeout = setTimeout(
                syncFocusState,
                Math.max(1.5 ** focusStateSyncingFailed * 1_000, 60_000),
            );
        } finally {
            syncingFocusState = false;
        }
    }

    function triggerDynamicStateSync(force: boolean = false) {
        if (!scheduledDynamicState || force) {
            if (force) {
                clearTimeout(dynamicStateSyncerTimeout);
            }

            syncDynamicState();
        }
    }

    function triggerFocusStateSync(force: boolean = false) {
        if (!scheduledFocusState || force) {
            if (force) {
                clearTimeout(focusStateSyncerTimeout);
            }

            syncFocusState();
        }
    }

    function triggerInitialSync() {
        if (currentState.peers[options.peerKey].dynamicState?.state) {
            triggerDynamicStateSync(true);
        }

        if (currentState.peers[options.peerKey].dynamicState?.state) {
            triggerFocusStateSync(true);
        }
    }

    airState.trpc.presence.roomUpdates.subscribe(
        {
            key: roomKey,
        },
        {
            async onData(message) {
                if (message.type === 'session-info') {
                    const resolvedToken =
                        typeof options.token === 'function'
                            ? await options.token()
                            : options.token;

                    await airState.trpc.presence.peerInit.mutate({
                        peerKey: options.peerKey,
                        token: resolvedToken ?? null,
                        sessionID: message.session_id,
                    });

                    sessionID = message.session_id;
                } else if (message.type === 'init') {
                    Object.assign(currentState.peers, message.state.peers);
                    Object.assign(currentState.summary, message.state.summary);

                    recalculateSummary();
                    notifyListeners();

                    triggerInitialSync();
                } else if (message.type === 'static-update') {
                    currentState.peers[message.peer_key] = {
                        ...currentState.peers[message.peer_key],
                        client_key: message.peer_key,
                        staticState: {
                            state: message.state,
                            lastUpdateTimestamp: message.timestamp,
                        },
                    };

                    recalculateSummary();
                    notifyListeners();
                } else if (message.type === 'dynamic-update') {
                    currentState.peers[message.peer_key] = {
                        ...currentState.peers[message.peer_key],
                        client_key: message.peer_key,
                        dynamicState: {
                            state: message.state as any,
                            lastUpdateTimestamp: message.timestamp,
                        },
                    };

                    recalculateSummary();
                    notifyListeners();
                } else if (message.type === 'focus-update') {
                    currentState.peers[message.peer_key] = {
                        ...currentState.peers[message.peer_key],
                        client_key: message.peer_key,
                        focusState: {
                            isFocused: message.isFocused,
                            lastUpdateTimestamp: message.timestamp,
                        },
                    };

                    recalculateSummary();
                    notifyListeners();
                }
            },
        },
    );

    return {
        get self() {
            return currentState.peers[options.peerKey];
        },
        get others() {
            const others = { ...currentState.peers };
            delete others[options.peerKey];

            return others;
        },
        updateDynamicState: (update) => {
            const nextState =
                typeof update === 'function'
                    ? update(
                          currentState.peers[options.peerKey].dynamicState?.state as any,
                      )
                    : update;

            currentState.peers[options.peerKey].dynamicState = {
                state: nextState,
                lastUpdateTimestamp: Date.now(),
            };

            triggerDynamicStateSync();
            recalculateSummary();
            notifyListeners();
        },
        updateFocusState: (isFocused) => {
            currentState.peers[options.peerKey].focusState = {
                isFocused: isFocused,
                lastUpdateTimestamp: Date.now(),
            };

            triggerFocusStateSync();
            recalculateSummary();
            notifyListeners();
        },
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
    };
}
export { TPresenceState };
