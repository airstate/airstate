import { controlPlanePublicProcedure } from '../../index.mjs';
import { z } from 'zod';
import { TRoomPresenceListener } from '../../../../../services/ephemeralState.mjs';
import { logger } from '../../../../../logger.mjs';

export type TPresenceMessageInitPeer = {
    peerId: string;

    lastConnected: number;
    lastDisconnected?: number;
};

export type TPresenceMessageInitPeers = {
    [peerId: string]: TPresenceMessageInitPeer;
};

export type TPresenceMessage =
    | {
          type: 'already-connected';
          roomId: string;
          peerId: string;
      }
    | {
          type: 'connected' | 'disconnected';
          roomId: string;
          peerId: string;
      }
    | {
          type: 'init';
          peers: TPresenceMessageInitPeers;
      };

export type TPresenceSender = (message: TPresenceMessage | null) => void;

export const presenceSubscriptionProcedure = controlPlanePublicProcedure
    .input(
        z.object({
            roomId: z.string(),
            peerId: z.string(),
            sessionId: z.string(),
        }),
    )
    .subscription(async function* ({ input, ctx, signal }) {
        let listener: TRoomPresenceListener | null = null;

        const roomId = input.roomId;
        const peerId = input.peerId;
        const sessionId = input.sessionId;

        const connectionStateTracker = ctx.services.ephemeralState.control.presence.connectionStateTracker;

        if (!(roomId in connectionStateTracker)) {
            connectionStateTracker[roomId] = {
                peers: {},
                listeners: new Set(),
            };
        }

        const roomTracker = connectionStateTracker[roomId];

        try {
            if (!(peerId in roomTracker.peers)) {
                roomTracker.peers[peerId] = {
                    peerInfo: {
                        peerId,
                        lastConnected: Date.now(),
                    },
                    sessionIds: new Set(),
                };
            }

            const peer = roomTracker.peers[peerId];

            if (peer.sessionIds.size === 0) {
                peer.peerInfo.lastConnected = Date.now();

                roomTracker.listeners.forEach((listener) => {
                    listener(roomId, 'connected', peerId);
                });
            }

            roomTracker.peers[peerId].sessionIds.add(sessionId);

            yield {
                type: 'init',
                peers: Object.fromEntries(
                    Object.entries(roomTracker.peers).map(([key, value]) => [key, value.peerInfo]),
                ),
            } satisfies TPresenceMessage;

            let send: TPresenceSender | null = null;

            listener = (roomId, event, peerId) => {
                send?.({
                    type: event,
                    roomId,
                    peerId,
                });
            };

            roomTracker.listeners.add(listener);

            signal?.addEventListener('abort', () => {
                send?.(null);
            });

            while (!signal?.aborted) {
                const message = await new Promise<TPresenceMessage | null>((resolve, reject) => {
                    send = resolve;
                });

                if (!message) {
                    break;
                } else {
                    yield message satisfies TPresenceMessage;
                }
            }
        } catch (error) {
            logger.error('presence subscription error', error);
        } finally {
            if (roomTracker.peers[peerId]) {
                const peer = roomTracker.peers[peerId];
                peer.sessionIds.delete(sessionId);

                if (peer.sessionIds.size === 0) {
                    roomTracker.peers[peerId].peerInfo.lastDisconnected = Date.now();

                    roomTracker.listeners.forEach((listener) => {
                        listener(roomId, 'disconnected', peerId);
                    });
                }
            }

            if (listener) {
                roomTracker.listeners.delete(listener);
            }
        }
    });

export type TPresenceSubscriptProcedure = typeof presenceSubscriptionProcedure;
