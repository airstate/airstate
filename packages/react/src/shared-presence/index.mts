import { useCallback, useEffect, useRef, useState } from 'react';
import { TSharedPresenceOptions, TSharedPresence, TPresenceState, sharedPresence } from '@airstate/client';
import { useForceUpdate } from '../utils/useForceUpdate.mjs';

export function useSharedPresence<T extends Record<string, any>>(
    options: TSharedPresenceOptions<T>,
): {
    self: TPresenceState<T>['peers'][string];
    others: TPresenceState<T>['peers'];
    stats: TPresenceState['stats'];
    setState: (value: T | ((prev: T) => T)) => void;
} {
    const resolvedInitState: TPresenceState<T> = {
        peers: {
            [options.peerId]: {
                peer_id: options.peerId,
            },
        },
        stats: {
            totalPeers: 0,
        },
    };

    if (options.initialState) {
        resolvedInitState.peers[options.peerId] = {
            ...resolvedInitState.peers[options.peerId],
            state: {
                state: options.initialState,
                lastUpdateTimestamp: Date.now(),
            },
        };
    }

    const [initialComputedState] = useState<TPresenceState<T>>(resolvedInitState);

    const sharedPresenceRef = useRef<TSharedPresence<T> | null>(null);

    const publicStateRef = useRef<TPresenceState<T>>(initialComputedState);

    const forceUpdate = useForceUpdate();

    useEffect(() => {
        const sharedPresenceInstance = sharedPresence<T>(options);
        sharedPresenceRef.current = sharedPresenceInstance;

        const cleanupOnUpdate = sharedPresenceInstance.onUpdate((value) => {
            publicStateRef.current = {
                peers: {
                    ...value.others,
                    [value.self.peer_id]: value.self,
                },
                stats: value.stats,
            };

            forceUpdate();
        });

        const cleanupOnError = sharedPresenceInstance.onError((error) => {
            console.error(error);
            throw new Error(error?.message);
        });

        return () => {
            cleanupOnError();
            cleanupOnUpdate();
        };
    }, []);

    const setState = useCallback((value: T | ((prev: T) => T)) => {
        if (!sharedPresenceRef.current) {
            throw new Error(`You can not update before sharedPresence is initialized`);
        }

        sharedPresenceRef.current.setState(value);
    }, []);

    return {
        self: publicStateRef.current.peers[options.peerId],
        get others() {
            const others = { ...publicStateRef.current.peers };
            delete others[options.peerId];

            return others;
        },
        stats: publicStateRef.current.stats,
        setState: setState,
    };
}
