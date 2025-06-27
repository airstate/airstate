import { useCallback, useEffect, useRef, useState } from 'react';
import { TSharedPresenceOptions, TSharedPresence, TPresenceState, sharedPresence } from '@airstate/client';
import { useForceUpdate } from '../utils/useForceUpdate.mjs';

export function useSharedPresence<T extends Record<string, any>>(
    options: TSharedPresenceOptions<T>,
): {
    self: TPresenceState<T>['peers'][string];
    others: TPresenceState<T>['peers'];
    summary: TPresenceState['summary'];
    setDynamicState: (value: T | ((prev: T) => T)) => void;
    setFocus: (isFocused: boolean) => void;
} {
    const resolvedInitState: TPresenceState<T> = {
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
        resolvedInitState.peers[options.peerKey] = {
            ...resolvedInitState.peers[options.peerKey],
            dynamicState: {
                state: options.initialDynamicState,
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
            publicStateRef.current = value;
            forceUpdate();
        });

        const cleanupOnConnect = sharedPresenceInstance.onConnect(() => {
            console.info('client connected...');
        });

        const cleanupOnDisconnect = sharedPresenceInstance.onDisconnect(() => {
            console.info('client disconnected.');
        });
        const cleanupOnError = sharedPresenceInstance.onError((error) => {
            console.error(error);
            throw new Error(error?.message);
        });

        return () => {
            cleanupOnConnect();
            cleanupOnDisconnect();
            cleanupOnError();
            cleanupOnUpdate();
        };
    }, []);

    const setDynamicState = useCallback((value: T | ((prev: T) => T)) => {
        if (!sharedPresenceRef.current) {
            throw new Error(`You can not update before sharedPresence is initialized`);
        }

        sharedPresenceRef.current.updateDynamicState(value);
    }, []);

    const setFocusState = useCallback((isFocused: boolean) => {
        if (!sharedPresenceRef.current) {
            throw new Error(`You can not update before sharedPresence is initialized`);
        }
        sharedPresenceRef.current.updateFocusState(isFocused);
    }, []);

    return {
        self: publicStateRef.current.peers[options.peerKey],
        get others() {
            const others = { ...publicStateRef.current.peers };
            delete others[options.peerKey];

            return others;
        },
        summary: publicStateRef.current.summary,
        setDynamicState: setDynamicState,
        setFocus: setFocusState,
    };
}
