export type TPresenceState<
    DYNAMIC_STATE_TYPE extends Record<string, any> = Record<string, any>,
    STATIC_STATE_TYPE extends Record<string, any> = Record<string, any>,
> = {
    peers: Record<
        string,
        {
            client_key: string;

            connectionState?: {
                connected: boolean;
                lastUpdateTimestamp: number;
            };

            focusState?: {
                isFocused: boolean;
                lastUpdateTimestamp: number;
            };

            staticState?: {
                state: STATIC_STATE_TYPE;
                lastUpdateTimestamp: number;
            };

            dynamicState?: {
                state: DYNAMIC_STATE_TYPE;
                lastUpdateTimestamp: number;
            };
        }
    >;
    summary: {
        totalPeers: number;
        focusedPeers: number;
    };
};
