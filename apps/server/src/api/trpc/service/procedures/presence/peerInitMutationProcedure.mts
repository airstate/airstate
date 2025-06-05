import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { servicePlanePassthroughProcedure } from '../../middleware/passthrough.mjs';
import { extractTokenPayload } from '../../../../../auth/permissions/index.mjs';
import { env } from '../../../../../env.mjs';
import { logger } from '../../../../../logger.mjs';
import { merge } from 'es-toolkit/object';
import { defaultPermissions } from '../../context.mjs';
import { TNATSPresenceMessage } from './_helpers.mjs';
import { createHash } from 'node:crypto';
import { StorageType } from 'nats';
import { runInAction } from 'mobx';

export const peerInitMutationProcedure = servicePlanePassthroughProcedure
    .meta({ writePermissionRequired: true })
    .input(
        z.object({
            sessionID: z.string(),
            peerKey: z.string(),
            token: z.string().nullable(),
        }),
    )
    .mutation(async function ({ ctx, input, signal }) {
        if (!(input.sessionID in ctx.services.localState.sessionMeta)) {
            throw new TRPCError({
                code: 'NOT_FOUND',
                message: 'session not found',
            });
        }

        const hashedRoomKey = ctx.services.localState.sessionMeta[input.sessionID].roomKeyHashed;
        const hashedPeerKey = createHash('sha256').update(input.peerKey).digest('hex');

        const key = `${ctx.accountID}__${hashedRoomKey}`;
        const commonSubjectPrefix = `presence.${key}`;
        const streamName = `presence.${key}`;

        const commonMeta = {
            peerKey: input.peerKey,
            hashedPeerKey: hashedPeerKey,
            permissions: defaultPermissions,
        };

        if (input.token) {
            if (!ctx.appSecret) {
                logger.warn('no shared signing key, cannot verify token');

                runInAction(() => {
                    ctx.services.localState.sessionMeta[input.sessionID].meta = commonMeta;
                });
            } else {
                const extracted = extractTokenPayload(input.token, ctx.appSecret);

                if (extracted) {
                    if (extracted.data.presence?.peerKey && extracted.data.presence.peerKey !== input.peerKey) {
                        throw new TRPCError({
                            code: 'CONFLICT',
                            message: 'peer key mismatch between token and request',
                        });
                    }

                    runInAction(() => {
                        ctx.services.localState.sessionMeta[input.sessionID].meta = {
                            ...commonMeta,
                            permissions: merge(defaultPermissions, extracted.data.permissions ?? {}),
                        };
                    });

                    if (extracted.data.presence?.staticState) {
                        // ensure the stream exists
                        await ctx.services.jetStreamManager.streams.add({
                            name: streamName,
                            subjects: [`presence.${key}.>`],
                            storage: StorageType.File,
                            max_msgs_per_subject: 1,
                        });

                        await ctx.services.jetStreamClient.publish(
                            `${commonSubjectPrefix}.static.${hashedPeerKey}`,
                            ctx.services.natsStringCodec.encode(
                                JSON.stringify({
                                    type: 'static',
                                    session_id: input.sessionID,
                                    peer_key: input.peerKey,
                                    staticState: extracted.data.presence.staticState,
                                    timestamp: Date.now(),
                                } satisfies TNATSPresenceMessage),
                            ),
                        );
                    }
                } else {
                    runInAction(() => {
                        ctx.services.localState.sessionMeta[input.sessionID].meta = commonMeta;
                    });
                }
            }
        } else {
            runInAction(() => {
                ctx.services.localState.sessionMeta[input.sessionID].meta = commonMeta;
            });
        }
    });

export type TPeerInitMutationProcedure = typeof peerInitMutationProcedure;
