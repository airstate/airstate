import { TMetricsTracker } from '../types/metrics.mjs';
import { atom } from 'synchronization-atom';

export type TAtom = ReturnType<typeof atom<any>>;

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

    service: {
        serverState: {
            channels: {
                [channelKey: string]: {
                    subscriptionKey: string;
                    channelKey: string;

                    stateKey: string;

                    subscriptionListeners: Set<(stateKey: string, data: any) => void>;

                    lock: TAtom;
                };
            };
        };
    };

    // telemetryTracker: TTelemetryTracker;
    metricTracker: TMetricsTracker;
};

export async function createEphemeralState(): Promise<TEphemeralState> {
    return {
        control: {
            presence: {
                connectionStateTracker: {},
            },
        },

        metricTracker: {
            services: {
                ydoc: {
                    documents: {},
                },
                presence: {
                    rooms: {},
                },
            },
        },

        service: {
            serverState: {
                channels: {},
            },
        },
    };
}

export type TEphemeralStateService = {
    ephemeralState: Awaited<ReturnType<typeof createEphemeralState>>;
};
