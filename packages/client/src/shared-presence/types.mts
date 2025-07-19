export type TPresenceState<
    DYNAMIC_STATE_TYPE extends Record<string, any> = Record<string, any>,
    STATIC_STATE_TYPE extends Record<string, any> = Record<string, any>,
> = {
    peers: Record<
        string,
        {
            peer_id: string;

            connectionState?: {
                connected: boolean;
                lastUpdateTimestamp: number;
            };

            meta?: {
                meta: STATIC_STATE_TYPE;
                lastUpdateTimestamp: number;
            };

            state?: {
                state: DYNAMIC_STATE_TYPE;
                lastUpdateTimestamp: number;
            };
        }
    >;
    stats: {
        totalPeers: number;
    };
};
