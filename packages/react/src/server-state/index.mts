import { serverState, TJSONAble, TServerState, TServerStateMap, TServerStateOptions } from '@airstate/client';
import { useEffect, useRef } from 'react';
import { useForceUpdate } from '../utils/useForceUpdate.mjs';

export type TServerStateHookOptions<T extends TJSONAble> = Pick<TServerStateOptions<T>, 'client' | 'validate'> & {
    enabled?: boolean;
};

export function useServerState<T extends TJSONAble>(
    key: string,
    options?: TServerStateHookOptions<T>,
): [
    T | undefined,
    {
        error: any | null;
        connected: boolean | undefined;
        started: boolean | undefined;
    },
];
export function useServerState<T extends TJSONAble>(
    keys: string[],
    options?: TServerStateHookOptions<T>,
): [
    TServerStateMap<T>,
    {
        connected: boolean | undefined;
        started: boolean | undefined;
    },
];
export function useServerState<T extends TJSONAble>(
    keys: string | string[],
    options?: TServerStateHookOptions<T>,
):
    | [
          TServerStateMap<T>,
          {
              connected: boolean | undefined;
              started: boolean | undefined;
          },
      ]
    | [
          T,
          {
              error?: any;
              connected: boolean | undefined;
              started: boolean | undefined;
          },
      ] {
    const isEnabled = !options || !('enabled' in options) || options.enabled === undefined || options.enabled === true;
    const serverStateRef = useRef<TServerState<T> | null>(null);
    const forceUpdate = useForceUpdate();

    useEffect(() => {
        if (!isEnabled) {
            if (serverStateRef.current) {
                serverStateRef.current.destroy();
            }

            return;
        }

        const serverStateInstance = serverState({
            client: options?.client,
            validate: options?.validate,
            initialKeys: Array.isArray(keys) ? keys : [keys],
        });

        serverStateRef.current = serverStateInstance;

        const cleanupOnUpdate = serverStateInstance.onUpdate((state, key, value, error) => {
            forceUpdate();
        });

        return () => {
            cleanupOnUpdate();

            serverStateInstance.destroy();
            serverStateRef.current = null;
        };
    }, [isEnabled]);

    useEffect(() => {
        if (!serverStateRef.current) {
            return;
        }

        if (Array.isArray(keys)) {
            serverStateRef.current.watch(keys);
        } else {
            serverStateRef.current.watch([keys]);
        }
    }, [keys]);

    return Array.isArray(keys)
        ? [
              serverStateRef.current?.state ?? {},
              {
                  connected: serverStateRef.current?.connected,
                  started: serverStateRef.current?.started,
              },
          ]
        : [
              serverStateRef.current?.state[keys]?.value as T | undefined as any,
              {
                  error: serverStateRef.current?.state[keys]?.error ?? null,
                  connected: serverStateRef.current?.connected,
                  started: serverStateRef.current?.started,
              },
          ];
}
