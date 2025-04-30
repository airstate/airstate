import { z } from 'zod';
import { createHash } from 'node:crypto';
import { AckPolicy, DeliverPolicy, StorageType } from 'nats';
import { getMergedUpdate } from './_helpers.mjs';
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

        // ensure the stream exists
        await ctx.services.jetStreamManager.streams.add({
            name: streamName,
            subjects: [subject],
            storage: StorageType.File,
            max_msgs_per_subject: -1,
        });

        const coordinatorValue = await returnOf(async () => {
            try {
                await ctx.services.sharedStateKV.create(`${streamName}__coordinator`, JSON.stringify(null));
                return null;
            } catch {
                const value = await ctx.services.sharedStateKV.get(`${streamName}__coordinator`);

                if (value) {
                    return JSON.parse(value.string()) as {
                        lastSeq: number;
                        lastMergedUpdate: string;
                    };
                }

                return null;
            }
        });

        const [mergedUpdate, lastSeq] = await getMergedUpdate(
            ctx.services,
            streamName,
            coordinatorValue?.lastSeq ?? -1,
            coordinatorValue?.lastMergedUpdate ?? null,
        );

        if (mergedUpdate) {
            yield {
                type: 'sync',
                lastSeq: lastSeq,
                updates: [mergedUpdate],
                final: true,
            } satisfies TMessage;
        } else {
            yield {
                type: 'sync',
                lastSeq: lastSeq,
                updates: [],
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
