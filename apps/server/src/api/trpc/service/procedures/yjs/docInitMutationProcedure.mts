import { z } from 'zod';
import { servicePlanePassthroughProcedure } from '../../middleware/passthrough.mjs';
import { TRPCError } from '@trpc/server';
import { defaultPermissions } from '../../context.mjs';
import { env } from '../../../../../env.mjs';
import { logger } from '../../../../../logger.mjs';
import { extractTokenPayload } from '../../../../../auth/permissions/index.mjs';
import { merge } from 'es-toolkit/object';
import { headers, StorageType } from 'nats';

export const docInitMutationProcedure = servicePlanePassthroughProcedure
    .meta({ writePermissionRequired: true })
    .input(
        z.object({
            sessionID: z.string(),
            token: z.string().nullable(),
            initialState: z.string().optional(),
        }),
    )
    .mutation(async function ({ ctx, input }) {
        if (!(input.sessionID in ctx.services.localState.sessionMeta)) {
            throw new TRPCError({
                code: 'NOT_FOUND',
                message: 'session not found',
            });
        }

        const sessionMeta = ctx.services.localState.sessionMeta[input.sessionID];
        const hashedRoomKey = sessionMeta.roomKeyHashed;

        const key = `${ctx.accountingIdentifier}__${hashedRoomKey}`;
        const subject = `yjs.${key}`;
        const streamName = `yjs_${key}`;

        const meta = {
            peerKey: '',
            hashedPeerKey: '',
            permissions: defaultPermissions,
        };

        if (input.token) {
            if (!env.SHARED_SIGNING_KEY) {
                logger.warn('no shared signing key, cannot verify token');
            } else {
                const extracted = extractTokenPayload(input.token, env.SHARED_SIGNING_KEY);

                if (extracted) {
                    meta.permissions = merge(defaultPermissions, extracted.data.permissions ?? {});
                }
            }
        }

        // ensure the stream exists
        await ctx.services.jetStreamManager.streams.add({
            name: streamName,
            subjects: [subject],
            storage: StorageType.File,
            max_msgs_per_subject: -1,
        });

        sessionMeta.meta = meta;
        let hasWrittenFirstUpdate: boolean = false;

        const publishHeaders = headers();
        publishHeaders.set('sessionID', input.sessionID);

        while (!!input.initialState) {
            try {
                await ctx.services.sharedStateKV.create(`${streamName}__init`, JSON.stringify(null));

                await ctx.services.jetStreamClient.publish(
                    subject,
                    ctx.services.natsStringCodec.encode(input.initialState),
                    {
                        headers: publishHeaders,
                    },
                );

                const streamInfo = await ctx.services.jetStreamManager.streams.info(streamName);
                const messageCount = streamInfo.state.messages;

                if (messageCount === 1) {
                    hasWrittenFirstUpdate = true;
                    break;
                } else {
                    await ctx.services.sharedStateKV.delete(`${streamName}__init`);
                }
            } catch {
                const streamInfo = await ctx.services.jetStreamManager.streams.info(streamName);
                const messageCount = streamInfo.state.messages;

                if (messageCount === 0) {
                    await ctx.services.sharedStateKV.delete(`${streamName}__init`);
                } else {
                    break;
                }
            }
        }

        return {
            hasWrittenFirstUpdate: hasWrittenFirstUpdate,
        };
    });

export type TDocInitMutationProcedure = typeof docInitMutationProcedure;
