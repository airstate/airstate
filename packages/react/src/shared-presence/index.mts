import { useCallback, useEffect, useRef, useState } from 'react';
import { TSharedPresenceOptions, TSharedPresence, TPresenceState, sharedPresence, TJSONAble } from '@airstate/client';
import { useForceUpdate } from '../utils/useForceUpdate.mjs';

export function useSharedPresence<T extends TJSONAble | undefined>(
    options: TSharedPresenceOptions<T>,
): {
    self: TPresenceState<T>['peers'][string];
    others: TPresenceState<T>['peers'];
    stats: TPresenceState<T>['stats'];
    setState: (value: T | ((prev: T) => T)) => void;
} {
    const resolvedInitState: TPresenceState<T> = {
        peers: {
            [options.peerId]: {
                peerId: options.peerId,

                state: options.initialState as any,
                lastUpdated: Date.now(),
            },
        },
        stats: {
            totalPeers: 0,
        },
    };

    if (options.initialState) {
        resolvedInitState.peers[options.peerId] = {
            ...resolvedInitState.peers[options.peerId],
            state: options.initialState,
            lastUpdated: Date.now(),
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
                    [value.self.peerId]: value.self,
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
        self: {
            peerId: options.peerId,
            state: publicStateRef.current.peers[options.peerId].state,
            lastUpdated: publicStateRef.current.peers[options.peerId].lastUpdated,
        },
        get others() {
            const others = { ...publicStateRef.current.peers };
            delete others[options.peerId];

            return others;
        },
        stats: publicStateRef.current.stats,
        setState: setState,
    };
}
