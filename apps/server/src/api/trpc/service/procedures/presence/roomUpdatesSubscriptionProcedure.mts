import { servicePlanePassthroughProcedure } from '../../middleware/passthrough.mjs';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { AckPolicy, DeliverPolicy, StorageType } from 'nats';
import { createHash } from 'node:crypto';
import { logger } from '../../../../../logger.mjs';
import { nanoid } from 'nanoid';
import { getInitialPresenceState, TNATSPresenceMessage, TPresenceState } from './_helpers.mjs';

export type TPresenceMessage =
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
            sessionID: z.string(),
        }),
    )
    .subscription(async function* ({ ctx, input, signal }) {
        if (!ctx.permissions.presence.join) {
            throw new TRPCError({
                code: 'FORBIDDEN',
                message: 'you do not have permission to read yjs updates',
            });
        }

        const clientSentKey = input.key;

        logger.debug(`new subscription for presence room: ${clientSentKey}`, {
            clientSentKey,
        });

        const hashedClientSentKey: string = createHash('sha256').update(clientSentKey).digest('hex');
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

            if (message.id !== input.sessionID) {
                if (message.type === 'static') {
                    yield {
                        type: 'static-update',
                        key: message.key,
                        id: message.id,
                        state: message.staticState,
                        timestamp: message.timestamp,
                    } satisfies TPresenceMessage;
                } else if (message.type === 'dynamic') {
                    yield {
                        type: 'dynamic-update',
                        key: message.key,
                        id: message.id,
                        state: message.dynamicState,
                        timestamp: message.timestamp,
                    } satisfies TPresenceMessage;
                } else if (message.type === 'focus') {
                    yield {
                        type: 'focus-update',
                        key: message.key,
                        id: message.id,
                        isFocused: message.isFocused,
                        timestamp: message.timestamp,
                    } satisfies TPresenceMessage;
                }
            }

            streamMessage.ack();
        }
    });
