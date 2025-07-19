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
// import { initTelemetryTrackerRoom } from '../../../../../utils/telemetry/rooms.mjs';
// import { initTelemetryTrackerClient, initTelemetryTrackerRoomClient } from '../../../../../utils/telemetry/clients.mjs';
// import { incrementTelemetryTrackers } from '../../../../../utils/telemetry/increment.mjs';

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
          meta: Record<string, any>;
      }
    | {
          peer_id: string;

          timestamp: number;

          type: 'state';
          state: Record<string, any>;
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

        runInAction(() => {
            ctx.services.localState.sessionMeta[sessionId] = {
                type: 'presence',
                roomId: clientSentRoomId,
                hashedRoomId: hashedClientSentRoomId,
            };
        });

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

            // const telemetryTrackerRoom = initTelemetryTrackerRoom(
            //     ctx.services.ephemeralState.telemetryTracker,
            //     'presence',
            //     key,
            // );

            // const telemetryTrackerClient = await initTelemetryTrackerClient(
            //     ctx.services.ephemeralState.telemetryTracker,
            //     {
            //         id: ctx.clientId ?? '',
            //         ipAddress: ctx.clientIPAddress ?? '0.0.0.0',
            //         userAgentString: ctx.clientUserAgentString ?? 'unknown',
            //         serverHostname: ctx.serverHostname ?? 'unknown',
            //         clientPageHostname: ctx.clientPageHostname ?? 'unknown',
            //     },
            // );

            // const telemetryTrackerRoomClient = initTelemetryTrackerRoomClient(
            //     telemetryTrackerRoom,
            //     telemetryTrackerClient,
            // );

            // ensure the stream exists
            await ctx.services.jetStreamManager.streams.add({
                name: streamName,
                subjects: [`presence.${key}.>`],
                storage: StorageType.File,
                max_msgs_per_subject: parseInt(env.AIRSTATE_PRESENCE_RETENTION_COUNT ?? '1'),
            });

            const consumerName = `presence_subscription_consumer_${nanoid()}`;

            const { state: initialState, lastSeq } = await getInitialPresenceState(ctx.services, streamName);

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

            const steamConsumer = await ctx.services.jetStreamClient.consumers.get(streamName, consumerName);

            const streamMessages = await steamConsumer.consume({
                // this is needed to that the consumer does not wait
                // for the message buffer to fill up to `max_messages`.
                max_messages: 1,
            });

            for await (const streamMessage of streamMessages) {
                const messageData = ctx.services.natsStringCodec.decode(streamMessage.data);
                const message = JSON.parse(messageData) as TNATSPresenceMessage;

                if (message.type === 'meta') {
                    yield {
                        type: 'meta',
                        peer_id: message.peer_id,
                        meta: message.meta,
                        timestamp: message.timestamp,
                    } satisfies TPresenceMessage;

                    // incrementTelemetryTrackers(
                    //     [telemetryTrackerRoom, telemetryTrackerClient, telemetryTrackerRoomClient],
                    //     JSON.stringify(message.staticState).length,
                    //     'relayed',
                    // );
                } else if (message.session_id !== sessionId) {
                    if (message.type === 'state') {
                        yield {
                            type: 'state',
                            peer_id: message.peer_id,
                            state: message.state,
                            timestamp: message.timestamp,
                        } satisfies TPresenceMessage;

                        // incrementTelemetryTrackers(
                        //     [telemetryTrackerRoom, telemetryTrackerClient, telemetryTrackerRoomClient],
                        //     JSON.stringify(message.dynamicState).length,
                        //     'relayed',
                        // );
                    }
                }

                streamMessage.ack();
            }
        } catch (error) {
            throw error;
        } finally {
            delete ctx.services.localState.sessionMeta[sessionId];
        }
    });

export type TRoomUpdatesSubscriptionProcedure = typeof roomUpdatesSubscriptionProcedure;
