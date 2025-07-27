import { z, ZodAny, ZodObject, ZodString, ZodType, type ZodTypeAny } from 'zod';
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
import { TJSONAble } from '../../../../../types/misc.mjs';
// import { initTelemetryTrackerRoom } from '../../../../../utils/telemetry/rooms.mjs';
// import { initTelemetryTrackerClient, initTelemetryTrackerRoomClient } from '../../../../../utils/telemetry/clients.mjs';
// import { incrementTelemetryTrackers } from '../../../../../utils/telemetry/increment.mjs';

export const peerInitMutationProcedure = servicePlanePassthroughProcedure
    .meta({ writePermissionRequired: true })
    .input(
        z
            .object({
                token: z.string().nullable(),
                initialState: z.any().optional() as ZodType<TJSONAble>,
            })
            .and(
                z.union([
                    z.object({
                        sessionID: z.string(),
                    }) as ZodType<{
                        /**
                         * @deprecated prefer `sessionId` instead.
                         */
                        sessionID: string;
                    }>,
                    z.object({
                        sessionId: z.string(),
                    }),
                ]),
            )
            .and(
                z.union([
                    z.object({
                        peerKey: z.string(),
                    }) as ZodType<{
                        /**
                         * @deprecated prefer `peerId` instead.
                         */
                        peerKey: string;
                    }>,
                    z.object({
                        peerId: z.string(),
                    }),
                ]),
            ),
    )
    .mutation(async function ({ ctx, input, signal }) {
        const sessionId = 'sessionId' in input ? input.sessionId : input.sessionID;
        const peerId = 'peerId' in input ? input.peerId : input.peerKey;

        if (!(sessionId in ctx.services.localState.sessionMeta)) {
            throw new TRPCError({
                code: 'NOT_FOUND',
                message: 'session not found',
            });
        }

        const sessionMeta = ctx.services.localState.sessionMeta[sessionId];

        if (sessionMeta.type !== 'presence') {
            throw new TRPCError({
                code: 'CONFLICT',
                message: `the session is of the wrong type, expected "presence" got "${sessionMeta.type}"`,
            });
        }

        const hashedRoomId = sessionMeta.hashedRoomId;
        const hashedPeerId = createHash('sha256').update(peerId).digest('hex');

        const key = `${ctx.namespace}__${hashedRoomId}`;
        const commonSubjectPrefix = `presence.${key}`;
        const streamName = `presence_${key}`;

        const meta = {
            peerId: peerId,
            hashedPeerId: hashedPeerId,
            permissions: defaultPermissions['presence'],
        };

        let tokenMeta: any = undefined;

        if (input.token) {
            if (!ctx.appSecret) {
                logger.error('no shared signing key, cannot verify token');
                throw new Error('no shared signing key');
            } else {
                const extracted = extractTokenPayload(input.token, ctx.appSecret);

                if (extracted) {
                    if (extracted.data.presence?.peerId && extracted.data.presence.peerId !== peerId) {
                        throw new TRPCError({
                            code: 'CONFLICT',
                            message: 'peerId mismatch between token and request',
                        });
                    }

                    Object.assign(meta, {
                        permissions: merge(defaultPermissions['presence'], extracted.data.presence?.permissions ?? {}),
                    });

                    tokenMeta = extracted.data.presence?.meta;
                }
            }
        }

        const needsStream = !!input.initialState || !!tokenMeta;

        if (needsStream) {
            // ensure the stream exists
            await ctx.services.jetStreamManager.streams.add({
                name: streamName,
                subjects: [`presence.${key}.>`],
                storage: StorageType.File,
                max_msgs_per_subject: parseInt(env.AIRSTATE_PRESENCE_RETENTION_COUNT ?? '1'),
            });
        }

        if (tokenMeta) {
            await ctx.services.jetStreamClient.publish(
                `${commonSubjectPrefix}.meta.${hashedPeerId}`,
                ctx.services.natsStringCodec.encode(
                    JSON.stringify({
                        type: 'meta',
                        session_id: sessionId,
                        peer_id: peerId,
                        meta: tokenMeta,
                        timestamp: Date.now(),
                    } satisfies TNATSPresenceMessage),
                ),
            );
        }

        if (input.initialState) {
            await ctx.services.jetStreamClient.publish(
                `${commonSubjectPrefix}.state.${hashedPeerId}`,
                ctx.services.natsStringCodec.encode(
                    JSON.stringify({
                        type: 'state',
                        session_id: sessionId,
                        peer_id: peerId,
                        state: input.initialState,
                        timestamp: Date.now(),
                    } satisfies TNATSPresenceMessage),
                ),
            );
        }

        runInAction(() => {
            ctx.services.localState.sessionMeta[sessionId].meta = meta;
        });
    });

export type TPeerInitMutationProcedure = typeof peerInitMutationProcedure;
