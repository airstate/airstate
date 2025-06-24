import { useCallback, useEffect, useRef, useState } from 'react';
import { sharedState, TAirStateClient, TJSONAble, TSharedState } from '@airstate/client';
import { useForceUpdate } from '../utils/useForceUpdate.mjs';

export type TOptions = {
    client?: TAirStateClient;
    key: string;
    token?: string | (() => string | Promise<string>);
};

export function useSharedState<T extends TJSONAble>(
    initialState: T | (() => T),
    options: TOptions,
): [T, (value: T | ((prev: T) => T)) => void, boolean] {
    const resolvedInitialValue = typeof initialState === 'function' ? initialState() : initialState;

    const [initialComputedState] = useState<T>(resolvedInitialValue);

    const sharedStateRef = useRef<TSharedState<T> | null>(null);

    const publicStateRef = useRef<T>(initialComputedState);

    const isSyncedRef = useRef(false);

    const forceUpdate = useForceUpdate();

    useEffect(() => {
        const sharedStateInstance = sharedState({
            client: options.client,
            key: options.key,
            token: options?.token,
            initialValue: initialState,
        });

        sharedStateRef.current = sharedStateInstance;

        const cleanupOnSynced = sharedStateInstance.onSynced((value) => {
            publicStateRef.current = value;

            if (!isSyncedRef.current) {
                isSyncedRef.current = true;
            }

            forceUpdate();
        });

        const cleanupOnUpdate = sharedStateInstance.onUpdate((value) => {
            publicStateRef.current = value;

            forceUpdate();
        });

        const cleanupOnConnect = sharedStateInstance.onConnect(() => {
            console.info('client connected...');
        });

        const cleanupOnDisconnect = sharedStateInstance.onDisconnect(() => {
            console.info('client disconnected.');
        });
        const cleanupOnError = sharedStateInstance.onError((error) => {
            console.error(error);
            throw new Error(error?.message);
        });

        return () => {
            cleanupOnConnect();
            cleanupOnDisconnect();
            cleanupOnError();
            cleanupOnSynced();
            cleanupOnUpdate();
            sharedStateInstance.destroy();
        };
    }, []);

    const setState = useCallback((value: T | ((prev: T) => T)) => {
        if (!sharedStateRef.current) {
            throw new Error(`You can not update before shared state is initialized`);
        }

        const nextValue = value instanceof Function ? value(publicStateRef.current) : value;

        sharedStateRef.current.update(nextValue);
        publicStateRef.current = nextValue;

        forceUpdate();
    }, []);

    return [publicStateRef.current, setState, isSyncedRef.current];
}
