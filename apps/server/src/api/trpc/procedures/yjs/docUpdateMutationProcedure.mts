import { z } from 'zod';
import { publicProcedure } from '../../index.mjs';
import { createHash } from 'node:crypto';
import { AckPolicy, DeliverPolicy, headers } from 'nats';
import { getInitialState } from './_helpers.mjs';
import { TRPCError } from '@trpc/server';
import { returnOf } from 'scope-utilities';
import { logger } from '../../../../logger.mjs';

export const docUpdateMutationProcedure = publicProcedure
    .input(
        z.object({
            key: z.string(),
            sessionID: z.string(),
            encodedUpdate: z.string(),
        }),
    )
    .mutation(async function ({ ctx, input, signal }) {
        const clientSentKey = input.key;
        const hashedClientSentKey: string = createHash('sha256').update(clientSentKey).digest('hex');

        const key = `${ctx.accountingIdentifier}__${hashedClientSentKey}`;
        const subject = `room.${key}`;

        const publishHeaders = headers();
        publishHeaders.set('sessionID', input.sessionID);

        try {
            await ctx.services.jetStreamClient.publish(
                subject,
                ctx.services.natsStringCodec.encode(input.encodedUpdate),
                {
                    headers: publishHeaders,
                },
            );
        } catch (err) {
            throw new TRPCError({
                code: 'INTERNAL_SERVER_ERROR',
                message: 'failed to publish update',
            });
        }
    });

export type TDocUpdateMutationProcedure = typeof docUpdateMutationProcedure;
