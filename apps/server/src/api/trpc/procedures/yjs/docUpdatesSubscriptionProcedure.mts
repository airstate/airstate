import { z } from 'zod';
import { createHash } from 'node:crypto';
import { AckPolicy, DeliverPolicy } from 'nats';
import { getInitialState } from './_helpers.mjs';
import { TRPCError } from '@trpc/server';
import { returnOf } from 'scope-utilities';
import { logger } from '../../../../logger.mjs';
import { protectedProcedure } from '../../middleware/protected.mjs';

export type TMessage =
    | {
          type: 'sync';
          updates: string[];
          lastSeq: number;
          final: boolean;
      }
    | {
          type: 'first';
          lastSeq: number;
      }
    | {
          type: 'update';
          client: string;
          updates: string[];
          lastSeq: number;
      };

export const docUpdatesSubscriptionProcedure = protectedProcedure
    .input(
        z.object({
            key: z.string(),
            sessionID: z.string(),
            initialState: z.string(),
        }),
    )
    .subscription(async function* ({ ctx, input, signal }) {
        const clientSentKey = input.key;

        logger.debug(`new subscription for yjs doc update key: ${clientSentKey}`, {
            clientSentKey,
        });

        const hashedClientSentKey: string = createHash('sha256').update(clientSentKey).digest('hex');

        const key = `${ctx.accountingIdentifier}__${hashedClientSentKey}`;
        const streamName = key;
        const subject = `room.${key}`;
        const consumerName = `consumer_${ctx.connectionID}`;

        if (!ctx.resolvedPermission.write) {
            try {
                await ctx.services.jetStreamManager.streams.info(streamName);
            } catch (error) {
                logger.info(`client with id ${ctx.connectionID} does not have write access but is first`);
                throw new TRPCError({
                    code: 'NOT_FOUND',
                    message: 'There is still no update in this room to read',
                });
            }
        }

        const [initialState, lastSeq, isFirst] = await returnOf(async () => {
            try {
                return await getInitialState(ctx.services, streamName, subject, input.initialState);
            } catch (error) {
                throw new TRPCError({
                    code: 'INTERNAL_SERVER_ERROR',
                    message: 'could not process initial state',
                });
            }
        });

        if (isFirst) {
            yield {
                type: 'first',
                lastSeq: lastSeq,
            } satisfies TMessage;
        } else {
            yield {
                type: 'sync',
                updates: [initialState],
                lastSeq: lastSeq,
                final: true,
            } satisfies TMessage;
        }

        await ctx.services.jetStreamManager.consumers.add(streamName, {
            name: consumerName,
            ack_policy: AckPolicy.Explicit,
            deliver_policy: DeliverPolicy.StartSequence,
            opt_start_seq: lastSeq + 1,
        });

        const steamConsumer = await ctx.services.jetStreamClient.consumers.get(streamName, consumerName);

        const streamMessages = await steamConsumer.consume({
            max_messages: 1,
        });

        for await (const streamMessage of streamMessages) {
            const updateSessionID = streamMessage.headers?.get('sessionID');

            if (updateSessionID !== input.sessionID) {
                yield {
                    type: 'update',
                    updates: [ctx.services.natsStringCodec.decode(streamMessage.data)],
                    lastSeq: streamMessage.seq,
                    client: updateSessionID ?? '',
                } satisfies TMessage;
            }

            streamMessage.ack();
        }
    });

export type TDocUpdatesSubscriptionProcedure = typeof docUpdatesSubscriptionProcedure;
