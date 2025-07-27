import { TTelemetryTracker } from '../types/telemetry.mjs';

export type TRoomPresenceListener = (roomId: string, event: 'connected' | 'disconnected', peerId: string) => void;

export type TConnectionStatePeer = {
    peerInfo: {
        peerId: string;

        lastConnected: number;
        lastDisconnected?: number;
    };

    sessionIds: Set<string>;
};

export type TConnectionStatePeers = {
    [peerId: string]: TConnectionStatePeer;
};

export type TEphemeralState = {
    control: {
        presence: {
            connectionStateTracker: {
                [roomId: string]: {
                    peers: TConnectionStatePeers;
                    listeners: Set<TRoomPresenceListener>;
                };
            };
        };
    };
};

export async function createEphemeralState(): Promise<TEphemeralState> {
    return {
        control: {
            presence: {
                connectionStateTracker: {},
            },
        },
    };
}

export type TEphemeralStateService = {
    ephemeralState: Awaited<ReturnType<typeof createEphemeralState>>;
};
