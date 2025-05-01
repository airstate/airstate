import { z } from 'zod';
import { createHash } from 'node:crypto';
import { headers } from 'nats';
import { TRPCError } from '@trpc/server';
import { servicePlanePassthroughProcedure } from '../../middleware/passthrough.mjs';

export const docUpdateMutationProcedure = servicePlanePassthroughProcedure
    .meta({ writePermissionRequired: true })
    .input(
        z.object({
            key: z.string(),
            sessionID: z.string(),
            encodedUpdates: z.string().array(),
        }),
    )
    .mutation(async function ({ ctx, input, signal }) {
        if (!ctx.resolvedPermissions.yjs.write) {
            throw new TRPCError({
                code: 'FORBIDDEN',
                message: 'you do not have permission to write yjs updates',
            });
        }

        const clientSentKey = input.key;
        const hashedClientSentKey: string = createHash('sha256').update(clientSentKey).digest('hex');

        const key = `${ctx.accountingIdentifier}__${hashedClientSentKey}`;
        const subject = `room.${key}`;

        const publishHeaders = headers();
        publishHeaders.set('sessionID', input.sessionID);

        try {
            for (const encodedUpdate of input.encodedUpdates) {
                await ctx.services.jetStreamClient.publish(
                    subject,
                    ctx.services.natsStringCodec.encode(encodedUpdate),
                    {
                        headers: publishHeaders,
                    },
                );
            }
        } catch (err) {
            throw new TRPCError({
                code: 'INTERNAL_SERVER_ERROR',
                message: 'failed to publish update',
            });
        }
    });

export type TDocUpdateMutationProcedure = typeof docUpdateMutationProcedure;
