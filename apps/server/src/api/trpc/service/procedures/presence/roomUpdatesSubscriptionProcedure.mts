import { servicePlanePassthroughProcedure } from '../../middleware/passthrough.mjs';
import { z } from 'zod';
import { AckPolicy, DeliverPolicy, StorageType } from 'nats';
import { createHash } from 'node:crypto';
import { logger } from '../../../../../logger.mjs';
import { nanoid } from 'nanoid';
import { getInitialPresenceState, TNATSPresenceMessage, TPresenceState } from './_helpers.mjs';
import { runInAction, when } from 'mobx';
import { TRPCError } from '@trpc/server';
import { initTelemetryTrackerRoom } from '../../../../../utils/telemetry/rooms.mjs';
import { initTelemetryTrackerClient, initTelemetryTrackerRoomClient } from '../../../../../utils/telemetry/clients.mjs';
import { incrementTelemetryTrackers } from '../../../../../utils/telemetry/increment.mjs';

export type TPresenceMessage =
    | {
          type: 'session-info';
          session_id: string;
      }
    | {
          type: 'init';
          state: TPresenceState;
      }
    | {
          peer_key: string;

          timestamp: number;

          type: 'static-update';
          state: Record<string, any>;
      }
    | {
          peer_key: string;

          timestamp: number;

          type: 'dynamic-update';
          state: Record<string, any>;
      }
    | {
          peer_key: string;

          timestamp: number;
          type: 'focus-update';
          isFocused: boolean;
      };

export const roomUpdatesSubscriptionProcedure = servicePlanePassthroughProcedure
    .input(
        z.object({
            key: z.string(),
        }),
    )
    .subscription<AsyncIterable<TPresenceMessage>>(async function* ({ ctx, input, signal }) {
        const clientSentKey = input.key;
        const sessionID = nanoid();
        const hashedClientSentKey: string = createHash('sha256').update(clientSentKey).digest('hex');

        runInAction(() => {
            ctx.services.localState.sessionMeta[sessionID] = {
                roomKey: clientSentKey,
                roomKeyHashed: hashedClientSentKey,
            };
        });

        try {
            yield {
                type: 'session-info',
                session_id: sessionID,
            } satisfies TPresenceMessage;

            await when(
                () =>
                    !(sessionID in ctx.services.localState.sessionMeta) ||
                    !!ctx.services.localState.sessionMeta[sessionID].meta,
                {
                    signal: signal,
                },
            );

            if (!(sessionID in ctx.services.localState.sessionMeta)) {
                return;
            }

            const sessionMeta = ctx.services.localState.sessionMeta[sessionID];

            if (!sessionMeta.meta) {
                return;
            }

            if (sessionMeta.meta.permissions.presence.join !== true) {
                throw new TRPCError({
                    code: 'FORBIDDEN',
                    message: 'permission to join presence room is not set',
                });
            }

            logger.debug(`new subscription for presence room: ${clientSentKey}`, {
                clientSentKey,
            });

            const key = `${ctx.namespace}__${hashedClientSentKey}`;

            const streamName = `presence_${key}`;

            const telemetryTrackerRoom = initTelemetryTrackerRoom(
                ctx.services.ephemeralState.telemetryTracker,
                'presence',
                key,
            );

            const telemetryTrackerClient = await initTelemetryTrackerClient(
                ctx.services.ephemeralState.telemetryTracker,
                {
                    id: ctx.clientId ?? '',
                    ipAddress: ctx.clientIPAddress ?? '0.0.0.0',
                    userAgentString: ctx.clientUserAgentString ?? 'unknown',
                    serverHostname: ctx.serverHostname ?? 'unknown',
                    clientPageHostname: ctx.clientPageHostname ?? 'unknown',
                },
            );

            const telemetryTrackerRoomClient = initTelemetryTrackerRoomClient(
                telemetryTrackerRoom,
                telemetryTrackerClient,
            );

            // ensure the stream exists
            await ctx.services.jetStreamManager.streams.add({
                name: streamName,
                subjects: [`presence.${key}.>`],
                storage: StorageType.File,
                max_msgs_per_subject: 1,
            });

            const consumerName = `consumer_${nanoid()}`;

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
                max_messages: 1,
            });

            for await (const streamMessage of streamMessages) {
                const messageData = ctx.services.natsStringCodec.decode(streamMessage.data);
                const message = JSON.parse(messageData) as TNATSPresenceMessage;

                if (message.type === 'static') {
                    yield {
                        type: 'static-update',
                        peer_key: message.peer_key,
                        state: message.staticState,
                        timestamp: message.timestamp,
                    } satisfies TPresenceMessage;

                    incrementTelemetryTrackers(
                        [telemetryTrackerRoom, telemetryTrackerClient, telemetryTrackerRoomClient],
                        JSON.stringify(message.staticState).length,
                        'relayed',
                    );
                } else if (message.session_id !== sessionID) {
                    if (message.type === 'dynamic') {
                        yield {
                            type: 'dynamic-update',
                            peer_key: message.peer_key,
                            state: message.dynamicState,
                            timestamp: message.timestamp,
                        } satisfies TPresenceMessage;

                        incrementTelemetryTrackers(
                            [telemetryTrackerRoom, telemetryTrackerClient, telemetryTrackerRoomClient],
                            JSON.stringify(message.dynamicState).length,
                            'relayed',
                        );
                    } else if (message.type === 'focus') {
                        yield {
                            type: 'focus-update',
                            peer_key: message.peer_key,
                            isFocused: message.isFocused,
                            timestamp: message.timestamp,
                        } satisfies TPresenceMessage;

                        incrementTelemetryTrackers(
                            [telemetryTrackerRoom, telemetryTrackerClient, telemetryTrackerRoomClient],
                            0,
                            'relayed',
                        );
                    }
                }

                streamMessage.ack();
            }
        } catch (error) {
            throw error;
        } finally {
            delete ctx.services.localState.sessionMeta[sessionID];
        }
    });

export type TRoomUpdatesSubscriptionProcedure = typeof roomUpdatesSubscriptionProcedure;
