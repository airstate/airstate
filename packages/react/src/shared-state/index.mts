import { useCallback, useEffect, useRef, useState } from 'react';
import { sharedState, TAirStateClient, TJSONAble, TSharedState } from '@airstate/client';
import { useForceUpdate } from '../utils/useForceUpdate.mjs';

export type TOptions<T extends TJSONAble> = {
    client?: TAirStateClient;

    /**
     * @deprecated prefer `channel` instead
     */
    key?: string;

    channel?: string;
    token?: string | (() => string | Promise<string>);

    validate?: (rawState: any) => T;

    onError?: (error: any) => void;
};

export function useSharedState<T extends TJSONAble>(
    initialState: T | (() => T),
    options?: TOptions<T>,
): [T, (value: T | ((prev: T) => T)) => void, boolean, any] {
    const resolvedInitialValue = typeof initialState === 'function' ? initialState() : initialState;

    const [initialComputedState] = useState<T>(resolvedInitialValue);

    const errorRef = useRef<any>(undefined);

    const sharedStateRef = useRef<TSharedState<T> | null>(null);

    const publicStateRef = useRef<T>(initialComputedState);

    const isSyncedRef = useRef(false);

    const forceUpdate = useForceUpdate();

    useEffect(() => {
        const sharedStateInstance = sharedState({
            client: options?.client,
            channel: options?.channel ?? options?.key,
            token: options?.token,
            initialValue: initialState,

            validate: options?.validate,
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
            errorRef.current = undefined;

            forceUpdate();
        });

        const cleanupOnError = sharedStateInstance.onError((error) => {
            errorRef.current = error;
            options?.onError?.(error);

            forceUpdate();
        });

        return () => {
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

    return [publicStateRef.current, setState, isSyncedRef.current, errorRef];
}
