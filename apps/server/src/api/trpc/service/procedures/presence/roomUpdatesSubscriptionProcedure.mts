import { servicePlanePassthroughProcedure } from '../../middleware/passthrough.mjs';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { AckPolicy, DeliverPolicy, StorageType } from 'nats';
import { createHash } from 'node:crypto';
import { logger } from '../../../../../logger.mjs';
import { nanoid } from 'nanoid';
import { getInitialPresenceState } from './_helpers.mjs';

export const docUpdatesSubscriptionProcedure = servicePlanePassthroughProcedure
    .input(
        z.object({
            key: z.string(),
            sessionID: z.string(),
        }),
    )
    .subscription(async function* ({ ctx, input, signal }) {
        if (!ctx.resolvedPermissions.presence.join) {
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

        const initialState = await getInitialPresenceState(ctx.services, streamName);

        await ctx.services.jetStreamManager.consumers.add(streamName, {
            name: consumerName,
            ack_policy: AckPolicy.Explicit,
            deliver_policy: DeliverPolicy.StartSequence,
            inactive_threshold: 10 * 1e9,
        });

        const steamConsumer = await ctx.services.jetStreamClient.consumers.get(streamName, consumerName);

        const streamMessages = await steamConsumer.consume({
            max_messages: 1,
        });
    });
