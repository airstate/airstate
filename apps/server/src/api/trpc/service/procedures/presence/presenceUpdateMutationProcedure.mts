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
// import { initTelemetryTrackerRoom } from '../../../../../utils/telemetry/rooms.mjs';
// import { initTelemetryTrackerClient, initTelemetryTrackerRoomClient } from '../../../../../utils/telemetry/clients.mjs';
// import { incrementTelemetryTrackers } from '../../../../../utils/telemetry/increment.mjs';

export const presenceUpdateMutationProcedure = servicePlanePassthroughProcedure
    .meta({ writePermissionRequired: true })
    .input(
        z.object({
            sessionID: z.string(),
            update: z.discriminatedUnion('type', [
                z.object({
                    type: z.literal('dynamic-update'),
                    state: z.record(z.string(), z.any()),
                }),
                z.object({
                    type: z.literal('focus-update'),
                    isFocused: z.boolean(),
                }),
            ]),
        }),
    )
    .mutation(async function ({ ctx, input, signal }) {
        if (!(input.sessionID in ctx.services.localState.sessionMeta)) {
            throw new TRPCError({
                code: 'NOT_FOUND',
                message: 'session not found',
            });
        }

        const sessionMeta = ctx.services.localState.sessionMeta[input.sessionID];

        if (!sessionMeta.meta) {
            throw new TRPCError({
                code: 'PRECONDITION_FAILED',
                message: 'this session is not initialized yet',
            });
        }

        const hashedRoomKey = sessionMeta.roomKeyHashed;

        const peerKey = sessionMeta.meta.peerKey;
        const hashedPeerKey = sessionMeta.meta.hashedPeerKey;

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

        if (input.update.type === 'dynamic-update') {
            await ctx.services.jetStreamClient.publish(
                `${commonSubjectPrefix}.dynamic.${hashedPeerKey}`,
                ctx.services.natsStringCodec.encode(
                    JSON.stringify({
                        type: 'dynamic',
                        session_id: input.sessionID,
                        peer_key: peerKey,
                        dynamicState: input.update.state,
                        timestamp: Date.now(),
                    } satisfies TNATSPresenceMessage),
                ),
            );

            // incrementTelemetryTrackers(
            //     [telemetryTrackerRoom, telemetryTrackerClient, telemetryTrackerRoomClient],
            //     JSON.stringify(input.update.state).length,
            //     'received',
            // );
        } else {
            await ctx.services.jetStreamClient.publish(
                `${commonSubjectPrefix}.focus.${hashedPeerKey}`,
                ctx.services.natsStringCodec.encode(
                    JSON.stringify({
                        type: 'focus',
                        session_id: input.sessionID,
                        peer_key: peerKey,
                        isFocused: input.update.isFocused,
                        timestamp: Date.now(),
                    } satisfies TNATSPresenceMessage),
                ),
            );

            // incrementTelemetryTrackers(
            //     [telemetryTrackerRoom, telemetryTrackerClient, telemetryTrackerRoomClient],
            //     0,
            //     'received',
            // );
        }
    });

export type TPresenceUpdateMutationProcedure = typeof presenceUpdateMutationProcedure;
