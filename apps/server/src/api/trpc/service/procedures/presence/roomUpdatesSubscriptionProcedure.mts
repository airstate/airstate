import { servicePlanePassthroughProcedure } from '../../middleware/passthrough.mjs';
import { z } from 'zod';
import { AckPolicy, DeliverPolicy, StorageType } from 'nats';
import { createHash } from 'node:crypto';
import { logger } from '../../../../../logger.mjs';
import { nanoid } from 'nanoid';
import { getInitialPresenceState, TNATSPresenceMessage, TPresenceState } from './_helpers.mjs';
import { runInAction, when } from 'mobx';
import { TRPCError } from '@trpc/server';
import { env } from '../../../../../env.mjs';
import { Consumer, ConsumerMessages } from 'nats/lib/jetstream/consumer.js';
import { atom } from 'synchronization-atom';
import { createBlockingQueue } from '../../../../../lib/queue/index.mjs';
import { TPresenceMessageInitPeers } from '../../../control/procedures/presence/presence.mjs';

export type TPresenceMessage =
    | {
          type: 'session-info';
          session_id: string;
      }
    | {
          type: 'init';
          state: TPresenceState<any>;
      }
    | {
          peer_id: string;

          timestamp: number;

          type: 'meta';
          meta: any;
      }
    | {
          peer_id: string;

          timestamp: number;

          type: 'state';
          state: any;
      }
    | {
          peer_id: string;

          timestamp: number;

          type: 'connected' | 'disconnected';
      };

export const roomUpdatesSubscriptionProcedure = servicePlanePassthroughProcedure
    .input(
        z.object({
            room: z.string(),
        }),
    )
    .subscription<AsyncIterable<TPresenceMessage>>(async function* ({ ctx, input, signal }) {
        const clientSentRoomId = input.room;
        const sessionId = nanoid();
        const hashedClientSentRoomId: string = createHash('sha256').update(clientSentRoomId).digest('hex');

        const trailingOctetPair = hashedClientSentRoomId.slice(-4);
        const presenceControlPlaneSelector = parseInt(trailingOctetPair, 16);
        const controlPlaneClients = ctx.services.controlClients.clients;
        const controlPlaneClient = controlPlaneClients[presenceControlPlaneSelector % controlPlaneClients.length];

        runInAction(() => {
            ctx.services.localState.sessionMeta[sessionId] = {
                type: 'presence',
                roomId: clientSentRoomId,
                hashedRoomId: hashedClientSentRoomId,
            };
        });

        let streamConsumer: Consumer | null = null;
        let streamMessages: ConsumerMessages | null = null;
        let cleanupConnectionStateSubscription: (() => void) | null = null;

        try {
            yield {
                type: 'session-info',
                session_id: sessionId,
            } satisfies TPresenceMessage;

            await when(
                () =>
                    !(sessionId in ctx.services.localState.sessionMeta) ||
                    ctx.services.localState.sessionMeta[sessionId].type !== 'presence' ||
                    !!ctx.services.localState.sessionMeta[sessionId].meta,
                {
                    signal: signal,
                },
            );

            if (!(sessionId in ctx.services.localState.sessionMeta)) {
                return;
            }

            const sessionType = ctx.services.localState.sessionMeta[sessionId].type;

            if (sessionType !== 'presence') {
                throw new TRPCError({
                    code: 'CONFLICT',
                    message: `the initialized session type for sessionId "${sessionId}" was "${sessionType}"; expected "presence"`,
                });
            }

            const sessionMeta = ctx.services.localState.sessionMeta[sessionId];

            if (sessionMeta.meta?.permissions.join !== true) {
                throw new TRPCError({
                    code: 'FORBIDDEN',
                    message: 'permission to join presence room is not set',
                });
            }

            logger.debug(`new subscription for presence room: ${clientSentRoomId}`, {
                clientSentKey: clientSentRoomId,
            });

            const key = `${ctx.namespace}__${hashedClientSentRoomId}`;
            const streamName = `presence_${key}`;

            // ensure the stream exists
            await ctx.services.jetStreamManager.streams.add({
                name: streamName,
                subjects: [`presence.${key}.>`],
                storage: StorageType.File,
                max_msgs_per_subject: parseInt(env.AIRSTATE_PRESENCE_RETENTION_COUNT ?? '1'),
            });

            const messageQueue = createBlockingQueue<TPresenceMessage | Error | null>();

            const consumerName = `presence_subscription_consumer_${nanoid()}`;

            const initialConnectionStateAtom = atom<null | TPresenceMessageInitPeers>(null);

            const connectionStateSubscription = controlPlaneClient.trpc.presence.subscribe(
                {
                    roomId: clientSentRoomId,
                    peerId: sessionMeta.meta.peerId,
                    sessionId: sessionId,
                },
                {
                    signal: signal,
                    onComplete() {
                        messageQueue.enqueue(null);
                    },
                    onError(error) {
                        messageQueue.enqueue(error);
                    },
                    onData(data) {
                        if (data.type === 'init') {
                            initialConnectionStateAtom.conditionallyUpdate(() => true, data.peers);
                        } else if (data.type === 'connected') {
                            if (data.peerId !== sessionMeta.meta!.peerId) {
                                messageQueue.enqueue({
                                    peer_id: data.peerId,
                                    type: 'connected',
                                    timestamp: Date.now(),
                                });
                            }
                        } else if (data.type === 'disconnected') {
                            if (data.peerId !== sessionMeta.meta!.peerId) {
                                messageQueue.enqueue({
                                    peer_id: data.peerId,
                                    type: 'disconnected',
                                    timestamp: Date.now(),
                                });
                            }
                        }
                    },
                },
            );

            cleanupConnectionStateSubscription = connectionStateSubscription.unsubscribe;

            await initialConnectionStateAtom.waitFor((data) => data !== null);

            const initialConnectionStateAtomState = initialConnectionStateAtom.getState();

            const initialConnectionStateData = initialConnectionStateAtomState!;

            const { state: initialState, lastSeq } = await getInitialPresenceState(
                ctx.services,
                streamName,
                initialConnectionStateData,
            );

            yield {
                type: 'init',
                state: initialState,
            } satisfies TPresenceMessage;

            if (lastSeq === 0) {
                await ctx.services.jetStreamManager.consumers.add(streamName, {
                    name: consumerName,
                    ack_policy: AckPolicy.Explicit,
                    deliver_policy: DeliverPolicy.All,
                    inactive_threshold: 10 * 1e9,
                });
            } else {
                await ctx.services.jetStreamManager.consumers.add(streamName, {
                    name: consumerName,
                    ack_policy: AckPolicy.Explicit,
                    deliver_policy: DeliverPolicy.StartSequence,
                    opt_start_seq: lastSeq + 1,
                    inactive_threshold: 10 * 1e9,
                });
            }

            streamConsumer = await ctx.services.jetStreamClient.consumers.get(streamName, consumerName);

            streamMessages = await streamConsumer.consume({
                // this is needed to that the consumer does not wait
                // for the message buffer to fill up to `max_messages`.
                max_messages: 1,
            });

            (async () => {
                try {
                    for await (const streamMessage of streamMessages) {
                        const messageData = ctx.services.natsStringCodec.decode(streamMessage.data);
                        const message = JSON.parse(messageData) as TNATSPresenceMessage;

                        if (message.type === 'meta') {
                            messageQueue.enqueue({
                                type: 'meta',
                                peer_id: message.peer_id,
                                meta: message.meta,
                                timestamp: message.timestamp,
                            } satisfies TPresenceMessage);
                        } else if (message.session_id !== sessionId) {
                            if (message.type === 'state') {
                                messageQueue.enqueue({
                                    type: 'state',
                                    peer_id: message.peer_id,
                                    state: message.state,
                                    timestamp: message.timestamp,
                                } satisfies TPresenceMessage);
                            }
                        }

                        streamMessage.ack();
                    }
                } catch (error) {
                    throw error;
                } finally {
                }
            })().then(() => {});

            while (true) {
                const message = await messageQueue.dequeue();

                if (message instanceof Error) {
                    throw message;
                } else if (message === null) {
                    break;
                } else {
                    yield message satisfies TPresenceMessage;
                }
            }
        } catch (error) {
            throw error;
        } finally {
            delete ctx.services.localState.sessionMeta[sessionId];

            if (streamMessages) {
                streamMessages.stop();
            }

            if (streamConsumer) {
                await streamConsumer.delete();
            }

            if (cleanupConnectionStateSubscription) {
                cleanupConnectionStateSubscription();
            }
        }
    });

export type TRoomUpdatesSubscriptionProcedure = typeof roomUpdatesSubscriptionProcedure;
