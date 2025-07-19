import { TJSONAble } from '../ydocjson.mjs';

export type TPresenceState<
    STATE_TYPE extends TJSONAble | undefined,
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
        }
    >;
    stats: {
        totalPeers: number;
    };
};
