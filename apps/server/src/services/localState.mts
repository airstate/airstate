import { makeAutoObservable } from 'mobx';
import { TPermissions } from '../schema/config.mjs';

export type TLocalState = {
    sessionMeta: Record<
        string,
        {
            roomKey: string;
            roomKeyHashed: string;

            set: boolean;

            permissions?: TPermissions;
        }
    >;
};

export async function createLocalState() {
    return makeAutoObservable<TLocalState>(
        {
            sessionMeta: {},
        },
        {},
        {
            autoBind: true,
            deep: true,
        },
    );
}

export type TLocalStateService = {
    localState: Awaited<ReturnType<typeof createLocalState>>;
};
