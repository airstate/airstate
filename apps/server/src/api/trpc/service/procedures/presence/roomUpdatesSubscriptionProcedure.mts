import { servicePlanePassthroughProcedure } from '../../middleware/passthrough.mjs';
import { z } from 'zod';
import { AckPolicy, DeliverPolicy, StorageType } from 'nats';
import { createHash } from 'node:crypto';
import { logger } from '../../../../../logger.mjs';
import { nanoid } from 'nanoid';
import { getInitialPresenceState, TNATSPresenceMessage, TPresenceState } from './_helpers.mjs';
import { when } from 'mobx';

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
          id: string;
          key: string;

          timestamp: number;

          type: 'static-update';
          state: Record<string, any>;
      }
    | {
          id: string;
          key: string;

          timestamp: number;

          type: 'dynamic-update';
          state: Record<string, any>;
      }
    | {
          id: string;
          key: string;

          timestamp: number;
          type: 'focus-update';
          isFocused: boolean;
      };

export const docUpdatesSubscriptionProcedure = servicePlanePassthroughProcedure
    .input(
        z.object({
            key: z.string(),
        }),
    )
    .subscription<AsyncIterable<TPresenceMessage>>(async function* ({ ctx, input, signal }) {
        const clientSentKey = input.key;
        const sessionID = nanoid();
        const hashedClientSentKey: string = createHash('sha256').update(clientSentKey).digest('hex');

        ctx.services.localState.sessionMeta[sessionID] = {
            roomKey: clientSentKey,
            roomKeyHashed: hashedClientSentKey,
            set: false,
        };

        try {
            yield {
                type: 'session-info',
                session_id: sessionID,
            } satisfies TPresenceMessage;

            await when(
                () =>
                    !(sessionID in ctx.services.localState.sessionMeta) ||
                    ctx.services.localState.sessionMeta[sessionID].set,
                {
                    signal: signal,
                },
            );

            if (!(sessionID in ctx.services.localState.sessionMeta)) {
                return;
            }

            if (!ctx.services.localState.sessionMeta[sessionID].permissions?.presence.join) {
                return;
            }

            logger.debug(`new subscription for presence room: ${clientSentKey}`, {
                clientSentKey,
            });

            const key = `${ctx.accountingIdentifier}__${hashedClientSentKey}`;

            const streamName = `presence.${key}`;

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

                if (message.session_id !== sessionID) {
                    if (message.type === 'static') {
                        yield {
                            type: 'static-update',
                            key: message.client_key,
                            id: message.session_id,
                            state: message.staticState,
                            timestamp: message.timestamp,
                        } satisfies TPresenceMessage;
                    } else if (message.type === 'dynamic') {
                        yield {
                            type: 'dynamic-update',
                            key: message.client_key,
                            id: message.session_id,
                            state: message.dynamicState,
                            timestamp: message.timestamp,
                        } satisfies TPresenceMessage;
                    } else if (message.type === 'focus') {
                        yield {
                            type: 'focus-update',
                            key: message.client_key,
                            id: message.session_id,
                            isFocused: message.isFocused,
                            timestamp: message.timestamp,
                        } satisfies TPresenceMessage;
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
