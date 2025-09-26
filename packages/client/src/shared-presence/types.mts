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

export type TPresencePeer<
    STATE_TYPE extends TJSONAble,
    META_TYPE extends Record<string, any> = Record<string, any>,
> = {
    peer: string;

    meta?: META_TYPE;
    state?: STATE_TYPE;
    error?: any;

    lastUpdated: number;
} & TPresenceConnectionState;

export type TPresenceSelfPeer<
    STATE_TYPE extends TJSONAble,
    META_TYPE extends Record<string, any> = Record<string, any>,
> = TPresencePeer<STATE_TYPE, META_TYPE> & { state: STATE_TYPE };

export type TPresenceState<
    STATE_TYPE extends TJSONAble,
    META_TYPE extends Record<string, any> = Record<string, any>,
> = {
    peers: Record<string, TPresencePeer<STATE_TYPE, META_TYPE>>;
    stats: {
        totalPeers: number;
    };
};
