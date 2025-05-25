import { z } from 'zod';
import { createHash } from 'node:crypto';
import { AckPolicy, DeliverPolicy, StorageType } from 'nats';
import { getMergedUpdate } from './_helpers.mjs';
import { returnOf } from 'scope-utilities';
import { logger } from '../../../../../logger.mjs';
import { servicePlanePassthroughProcedure } from '../../middleware/passthrough.mjs';
import { nanoid } from 'nanoid';
import { when } from 'mobx';
import { TRPCError } from '@trpc/server';

export type TYJSMessage =
    | {
          type: 'sync';
          updates: string[];
          lastSeq: number | null;
          final: boolean;
      }
    | {
          type: 'update';
          client: string;
          updates: string[];
          lastSeq: number;
      }
    | {
          type: 'session-info';
          session_id: string;
      };

export const docUpdatesSubscriptionProcedure = servicePlanePassthroughProcedure
    .input(
        z.object({
            key: z.string(),
        }),
    )
    .subscription(async function* ({ ctx, input, signal }): AsyncIterable<TYJSMessage> {
        const clientSentKey = input.key;
        const sessionID = nanoid();
        const hashedClientSentKey: string = createHash('sha256').update(clientSentKey).digest('hex');

        ctx.services.localState.sessionMeta[sessionID] = {
            roomKey: clientSentKey,
            roomKeyHashed: hashedClientSentKey,
        };

        try {
            yield {
                type: 'session-info',
                session_id: sessionID,
            } satisfies TYJSMessage;

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

            if (sessionMeta.meta.permissions.yjs.read !== true) {
                throw new TRPCError({
                    code: 'FORBIDDEN',
                    message: 'permission to receive doc updates is not set',
                });
            }

            logger.debug(`new subscription for yjs doc update key: ${clientSentKey}`, {
                clientSentKey,
            });

            const key = `${ctx.accountingIdentifier}__${hashedClientSentKey}`;
            const streamName = `yjs_${key}`;
            const subject = `yjs.${key}`;
            const consumerName = `consumer_${nanoid()}`;

            // ensure the stream exists
            await ctx.services.jetStreamManager.streams.add({
                name: streamName,
                subjects: [subject],
                storage: StorageType.File,
                max_msgs_per_subject: -1,
            });

            const coordinatorValue: {
                lastSeq: number;
                lastMergedUpdate: string;
            } | null = await returnOf(async () => {
                try {
                    await ctx.services.sharedStateKV.create(`${streamName}__coordinator`, JSON.stringify(null));
                    return null;
                } catch {
                    const value = await ctx.services.sharedStateKV.get(`${streamName}__coordinator`);

                    if (value) {
                        return JSON.parse(value.string()) as {
                            lastSeq: number;
                            lastMergedUpdate: string;
                        } | null;
                    }

                    return null;
                }
            });

            const merged = await getMergedUpdate(ctx.services, streamName, coordinatorValue);

            if (merged) {
                await ctx.services.sharedStateKV.put(
                    `${streamName}__coordinator`,
                    JSON.stringify({
                        lastSeq: merged.lastSeq,
                        lastMergedUpdate: merged.mergedUpdate,
                    }),
                );
            }

            if (merged) {
                yield {
                    type: 'sync',
                    lastSeq: merged.lastSeq,
                    updates: [merged.mergedUpdate],
                    final: true,
                } satisfies TYJSMessage;
            } else {
                yield {
                    type: 'sync',
                    lastSeq: null,
                    updates: [],
                    final: true,
                } satisfies TYJSMessage;
            }

            if (merged) {
                await ctx.services.jetStreamManager.consumers.add(streamName, {
                    name: consumerName,
                    ack_policy: AckPolicy.Explicit,
                    deliver_policy: DeliverPolicy.StartSequence,
                    opt_start_seq: merged.lastSeq + 1,
                    inactive_threshold: 10 * 1e9,
                });
            } else {
                await ctx.services.jetStreamManager.consumers.add(streamName, {
                    name: consumerName,
                    ack_policy: AckPolicy.Explicit,
                    deliver_policy: DeliverPolicy.All,
                    inactive_threshold: 10 * 1e9,
                });
            }

            const steamConsumer = await ctx.services.jetStreamClient.consumers.get(streamName, consumerName);

            const streamMessages = await steamConsumer.consume({
                max_messages: 1,
            });

            for await (const streamMessage of streamMessages) {
                const updateSessionID = streamMessage.headers?.get('sessionID');
                if (updateSessionID !== sessionID) {
                    yield {
                        type: 'update',
                        updates: [ctx.services.natsStringCodec.decode(streamMessage.data)],
                        lastSeq: streamMessage.seq,
                        client: updateSessionID ?? '',
                    } satisfies TYJSMessage;
                }

                streamMessage.ack();
            }
        } catch (error) {
            throw error;
        } finally {
            delete ctx.services.localState.sessionMeta[sessionID];
        }
    });

export type TDocUpdatesSubscriptionProcedure = typeof docUpdatesSubscriptionProcedure;
