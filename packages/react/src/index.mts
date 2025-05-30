import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { createSharedState, TJSONAble, TSharedStateReturn, TAirStateClient } from '@airstate/client';

export type TOptions = {
    client?: TAirStateClient;
    key: string;
    token?: string | (() => string | Promise<string>);
};

export function useForceUpdate() {
    const [, forceUpdate] = useReducer((x) => !x, false);
    return forceUpdate;
}

export function useSharedState<T extends TJSONAble>(
    initialState: T | (() => T),
    options: TOptions,
): [T, (value: T | ((prev: T) => T)) => void, boolean] {
    const resolvedInitialValue = typeof initialState === 'function' ? initialState() : initialState;

    const [initialComputedState] = useState<T>(resolvedInitialValue);

    const sharedStateRef = useRef<TSharedStateReturn<T> | null>(null);

    const publicStateRef = useRef<T>(initialComputedState);

    const isSyncedRef = useRef(false);

    const forceUpdate = useForceUpdate();

    useEffect(() => {
        const sharedState = createSharedState({
            client: options.client,
            key: options.key,
            token: options?.token,
            initialValue: initialState,
        });
        sharedStateRef.current = sharedState;

        const cleanupOnSynced = sharedState.onSynced((value) => {
            publicStateRef.current = value;

            if (!isSyncedRef.current) {
                isSyncedRef.current = true;
            }

            forceUpdate();
        });

        const cleanupOnUpdate = sharedState.onUpdate((value) => {
            publicStateRef.current = value;

            forceUpdate();
        });

        const cleanupOnConnect = sharedState.onConnect(() => {
            console.info('client connected...');
        });

        const cleanupOnDisconnect = sharedState.onDisconnect(() => {
            console.info('client disconnected.');
        });
        const cleanupOnError = sharedState.onError((error) => {
            console.error(error);
            throw new Error(error?.message);
        });

        return () => {
            cleanupOnConnect();
            cleanupOnDisconnect();
            cleanupOnError();
            cleanupOnSynced();
            cleanupOnUpdate();
            sharedState.destroy();
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

export { configure } from '@airstate/client';
