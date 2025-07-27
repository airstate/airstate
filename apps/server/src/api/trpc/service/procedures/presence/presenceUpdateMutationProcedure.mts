import { z, ZodAny, ZodType } from 'zod';
import { TRPCError } from '@trpc/server';
import { servicePlanePassthroughProcedure } from '../../middleware/passthrough.mjs';
import { extractTokenPayload } from '../../../../../auth/permissions/index.mjs';
import { env } from '../../../../../env.mjs';
import { logger } from '../../../../../logger.mjs';
import { merge } from 'es-toolkit/object';
import { defaultPermissions } from '../../context.mjs';
import { TNATSPresenceMessage } from './_helpers.mjs';
import { createHash } from 'node:crypto';

export const presenceUpdateMutationProcedure = servicePlanePassthroughProcedure
    .meta({ writePermissionRequired: true })
    .input(
        z
            .object({
                update: z.discriminatedUnion('type', [
                    z.object({
                        type: z.literal('state'),
                        state: z.any(),
                    }),
                ]),
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
            ),
    )
    .mutation(async function ({ ctx, input, signal }) {
        const sessionId = 'sessionId' in input ? input.sessionId : input.sessionID;

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
                message: 'the session is not a presence session',
            });
        }

        if (!sessionMeta.meta) {
            throw new TRPCError({
                code: 'PRECONDITION_FAILED',
                message: 'this session is not initialized yet',
            });
        }

        const hashedRoomKey = sessionMeta.hashedRoomId;

        const peerKey = sessionMeta.meta.peerId;
        const hashedPeerKey = sessionMeta.meta.hashedPeerId;

        const key = `${ctx.namespace}__${hashedRoomKey}`;
        const commonSubjectPrefix = `presence.${key}`;

        // const telemetryTrackerRoom = initTelemetryTrackerRoom(
        //     ctx.services.ephemeralState.telemetryTracker,
        //     'presence',
        //     key,
        // );

        // const telemetryTrackerClient = await initTelemetryTrackerClient(ctx.services.ephemeralState.telemetryTracker, {
        //     id: ctx.clientId ?? '',
        //     ipAddress: ctx.clientIPAddress ?? '0.0.0.0',
        //     userAgentString: ctx.clientUserAgentString ?? 'unknown',
        //     serverHostname: ctx.serverHostname ?? 'unknown',
        //     clientPageHostname: ctx.clientPageHostname ?? 'unknown',
        // });

        // const telemetryTrackerRoomClient = initTelemetryTrackerRoomClient(telemetryTrackerRoom, telemetryTrackerClient);

        if (input.update.type === 'state') {
            await ctx.services.jetStreamClient.publish(
                `${commonSubjectPrefix}.state.${hashedPeerKey}`,
                ctx.services.natsStringCodec.encode(
                    JSON.stringify({
                        type: 'state',
                        session_id: sessionId,
                        peer_id: peerKey,
                        state: input.update.state,
                        timestamp: Date.now(),
                    } satisfies TNATSPresenceMessage),
                ),
            );

            // incrementTelemetryTrackers(
            //     [telemetryTrackerRoom, telemetryTrackerClient, telemetryTrackerRoomClient],
            //     JSON.stringify(input.update.state).length,
            //     'received',
            // );
        }
    });

export type TPresenceUpdateMutationProcedure = typeof presenceUpdateMutationProcedure;
