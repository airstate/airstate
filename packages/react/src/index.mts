import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { configure as configureVanilla, sharedState, TJSONAble, TClientOptions, TSharedState } from '@airstate/client';

export type TOptions = {
    key: string;
    token?: string | (() => string | Promise<string>);
};

export function configure(options: TClientOptions) {
    configureVanilla(options);
}

export function useForceUpdate() {
    const [, forceUpdate] = useReducer((x) => !x, false);
    return forceUpdate;
}

export function useSharedState<T extends TJSONAble>(
    initialState: T | (() => T),
    options: TOptions,
): [T, (value: T | ((prev: T) => T)) => void, boolean] {
    const [initialComputedState] = useState<T>(initialState);
    const connectionRef = useRef<TSharedState<T> | null>(null);
    const publicStateRef = useRef<T>(initialComputedState);
    const readyRef = useRef(false);

    const forceUpdate = useForceUpdate();

    useEffect(() => {
        const sharedState = sharedState({
            key: options.key,
            token: options?.token,
            initialValue: initialState,
        });
        connectionRef.current = sharedState;

        sharedState.onSynced((value) => {
            console.log('Got the sync value in react', value);

            publicStateRef.current = value;
            if (!readyRef.current) {
                readyRef.current = true;
            }
            forceUpdate();
        });

        sharedState.subscribe((value) => {
            publicStateRef.current = value;
            forceUpdate();
        });

        sharedState.onConnect(() => {
            console.info('client connected...');
        });

        sharedState.onDisconnect(() => {
            console.info('client disconnected.');
        });
        sharedState.onError((error) => {
            console.error('client error:', error);
        });

        return () => {
            sharedState.destroy();
        };
    }, []);

    const setState = useCallback((value: T | ((prev: T) => T)) => {
        const nextValue = value instanceof Function ? value(publicStateRef.current) : value;
        connectionRef.current?.update(nextValue);
        publicStateRef.current = nextValue;
        forceUpdate();
    }, []);

    return [publicStateRef.current, setState, readyRef.current];
}
