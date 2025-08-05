import { TJSONAble } from '../ydocjson.mjs';

export type TPresenceConnectedState = {
    connected: true;
    lastConnected: number;
    lastDisconnected?: number;
};

export type TPresenceDisconnectedState = {
    connected: false;
    lastConnected?: number;
    lastDisconnected?: number;
};

export type TPresenceConnectionState =
    | TPresenceConnectedState
    | TPresenceDisconnectedState;

export type TPresenceState<
    STATE_TYPE extends TJSONAble,
    META_TYPE extends Record<string, any> = Record<string, any>,
> = {
    peers: Record<
        string,
        {
            peerId: string;

            meta?: META_TYPE;
            state: STATE_TYPE;
            error?: any;

            lastUpdated: number;
        } & TPresenceConnectionState
    >;
    stats: {
        totalPeers: number;
    };
};
