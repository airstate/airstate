import { getDefaultClient, TAirStateClient } from '../client.mjs';
import { TJSONAble } from '../ydocjson.mjs';
import { createServerStateClient, TAirStateServerStateClient } from './client.mjs';

export const serverStateClientCache = new Map<
    TAirStateClient,
    TAirStateServerStateClient
>();

export type TServerStateOptions<T extends TJSONAble> = {
    client?: TAirStateClient;
    initialKeys?: string[];

    validate?: (rawState: any) => T;
};

export type TServerStateMap<T extends TJSONAble> = Record<
    string,
    | {
          valid: true;
          value: T;
          error: null;
      }
    | {
          valid: false;
          value: undefined;
          error: any;
      }
    | undefined
>;

export type TServerState<T extends TJSONAble> = {
    readonly watchedKeys: string[];

    readonly watch: (keys: string[]) => void;
    readonly unwatch: (keys: string[]) => void;

    readonly state: TServerStateMap<T>;

    readonly onUpdate: (
        listener: (
            state: TServerStateMap<T>,
            updatedKey: string,
            updatedValue: T | undefined,
            error?: any,
        ) => void,
    ) => () => void;

    readonly onError: (listener: (error?: any) => void) => () => boolean;

    readonly connected: boolean;
    readonly onConnect: (listener: () => void) => () => boolean;
    readonly onDisconnect: (listener: () => void) => () => boolean;

    readonly started: boolean;
    readonly onStarted: (listener: () => void) => () => boolean;
    readonly onStopped: (listener: () => void) => () => boolean;

    readonly destroy: () => void;
};

export function serverState<T extends TJSONAble>(
    options?: TServerStateOptions<T>,
): TServerState<T> {
    const airState = options?.client ?? getDefaultClient();

    if (!serverStateClientCache.has(airState)) {
        serverStateClientCache.set(
            airState,
            createServerStateClient({
                client: airState,
            }),
        );
    }

    const updateListeners = new Set<
        (
            state: TServerStateMap<T>,
            updatedKey: string,
            updatedValue: T | undefined,
            error?: any,
        ) => void
    >();

    const errorListeners = new Set<(error?: any) => void>();
    const connectListeners = new Set<() => void>();
    const disconnectListeners = new Set<() => void>();
    const startedListeners = new Set<() => void>();
    const stoppedListeners = new Set<() => void>();

    const initialKeys = options?.initialKeys ?? [];

    const serverStateClient = serverStateClientCache.get(airState)!;

    const observer = serverStateClient.makeObserver();

    const state: TServerStateMap<T> = {};

    const cleanupObserverHandler = observer.onChange((key, value) => {
        if (options?.validate) {
            try {
                const data = options.validate(value);

                state[key] = {
                    valid: true,
                    value: data,
                    error: null,
                };

                updateListeners.forEach((listener) => {
                    listener(state, key, data);
                });
            } catch (error) {
                state[key] = {
                    valid: false,
                    value: undefined,
                    error: error,
                };

                updateListeners.forEach((listener) => {
                    listener(state, key, undefined, error);
                });
            }
        } else {
            state[key] = {
                valid: true,
                value: value,
                error: null,
            };

            updateListeners.forEach((listener) => {
                listener(state, key, value);
            });
        }
    });

    observer.watch(initialKeys);

    return {
        get state() {
            return state;
        },
        get watchedKeys() {
            return [...observer.watchedKeySet];
        },
        onUpdate(listener) {
            updateListeners.add(listener);
            return () => updateListeners.delete(listener);
        },
        watch: observer.watch,
        unwatch: observer.unwatch,
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
            return serverStateClient.started;
        },
        destroy() {
            connectListeners.clear();
            disconnectListeners.clear();

            errorListeners.clear();

            connectListeners.clear();
            disconnectListeners.clear();

            cleanupObserverHandler();

            observer.destroy();
        },
    };
}
