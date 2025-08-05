import { useCallback, useEffect, useRef } from 'react';
import { sharedPresence, TJSONAble, TPresenceState, TSharedPresence, TSharedPresenceOptions } from '@airstate/client';
import { useForceUpdate } from '../utils/useForceUpdate.mjs';

export function useSharedPresence<T extends TJSONAble>(
    options: TSharedPresenceOptions<T>,
): {
    self: TPresenceState<T>['peers'][string];
    others: TPresenceState<T>['peers'];
    stats: TPresenceState<T>['stats'];
    setState: (value: T | ((prev: T) => T)) => void;
    connected: boolean | undefined;
    started: boolean | undefined;
    error: any | null;
} {
    const isEnabled = !('enabled' in options) || options.enabled === undefined || options.enabled === true;

    const sharedPresenceRef = useRef<TSharedPresence<T> | null>(null);

    const temporarySelfState = useRef<T>(options.initialState);
    const publicSelfRef = useRef<TSharedPresence<T>['self'] | undefined>(undefined);

    const publicOthersStateRef = useRef<TPresenceState<T>>({
        peers: {},
        stats: {
            totalPeers: 1,
        },
    });

    const publicErrorRef = useRef<any | null>(null);

    const forceUpdate = useForceUpdate();

    useEffect(() => {
        if (!isEnabled) {
            if (sharedPresenceRef.current) {
                sharedPresenceRef.current.destroy();
            }

            return;
        }

        const sharedPresenceInstance = sharedPresence<T>({
            ...options,
        });

        sharedPresenceRef.current = sharedPresenceInstance;

        const cleanupOnUpdate = sharedPresenceInstance.onUpdate((value) => {
            publicSelfRef.current = value.self;

            publicOthersStateRef.current = {
                peers: {
                    ...value.others,
                },
                stats: value.stats,
            };

            forceUpdate();
        });

        const cleanupOnError = sharedPresenceInstance.onError((error) => {
            console.error(error);
            publicErrorRef.current = error;
        });

        const cleanupOnConnect = sharedPresenceInstance.onConnect(() => {
            forceUpdate();
        });

        const cleanupOnDisconnect = sharedPresenceInstance.onDisconnect(() => {
            forceUpdate();
        });

        return () => {
            cleanupOnError();
            cleanupOnUpdate();
            cleanupOnConnect();
            cleanupOnDisconnect();

            sharedPresenceInstance.destroy();
            sharedPresenceRef.current = null;
        };
    }, [isEnabled]);

    const setState = useCallback((update: T | ((prev: T) => T)) => {
        if (!sharedPresenceRef.current) {
            temporarySelfState.current = typeof update === 'function' ? update(temporarySelfState.current) : update;
        } else {
            sharedPresenceRef.current.setState(update);
        }
    }, []);

    return {
        get self() {
            return (
                publicSelfRef.current ?? {
                    peerId: options.peerId,
                    state: options.initialState,
                    lastUpdated: Date.now(),
                    connected: false,
                }
            );
        },
        others: publicOthersStateRef.current.peers,
        stats: {
            totalPeers: publicOthersStateRef.current.stats.totalPeers,
        },
        setState: setState,
        get connected() {
            return sharedPresenceRef.current?.connected;
        },
        get started() {
            return !!sharedPresenceRef.current?.started;
        },
        get error() {
            return publicErrorRef.current;
        },
    };
}
