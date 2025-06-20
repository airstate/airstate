import { z } from 'zod';
import { createHash } from 'node:crypto';
import { headers } from 'nats';
import { TRPCError } from '@trpc/server';
import { servicePlanePassthroughProcedure } from '../../middleware/passthrough.mjs';
import { resolvePermissions } from '../../../../../auth/permissions/index.mjs';
import { initTelemetryTrackerRoom } from '../../../../../utils/telemetry/rooms.mjs';
import { initTelemetryTrackerClient, initTelemetryTrackerRoomClient } from '../../../../../utils/telemetry/clients.mjs';
import { incrementTelemetryTrackers } from '../../../../../utils/telemetry/increment.mjs';

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
        if (ctx.services.localState.sessionMeta[input.sessionID].meta?.permissions.yjs.write !== true) {
            throw new TRPCError({
                code: 'FORBIDDEN',
                message: 'permission to send doc updates is not set',
            });
        }

        const clientSentKey = input.key;
        const hashedClientSentKey: string = createHash('sha256').update(clientSentKey).digest('hex');

        const key = `${ctx.accountID}__${hashedClientSentKey}`;
        const subject = `yjs.${key}`;

        const telemetryTrackerRoom = initTelemetryTrackerRoom(
            ctx.services.ephemeralState.telemetryTracker,
            'ydoc',
            key,
        );

        const telemetryTrackerClient = await initTelemetryTrackerClient(ctx.services.ephemeralState.telemetryTracker, {
            id: ctx.clientSentClientID ?? '',
            ipAddress: ctx.clientIPAddress ?? '0.0.0.0',
            userAgentString: ctx.clientUserAgentString ?? 'unknown',
            serverHostname: ctx.serverHostname ?? 'unknown',
            clientPageHostname: ctx.clientPageHostname ?? 'unknown',
        });

        const telemetryTrackerRoomClient = initTelemetryTrackerRoomClient(telemetryTrackerRoom, telemetryTrackerClient);

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

                incrementTelemetryTrackers(
                    [telemetryTrackerRoom, telemetryTrackerClient, telemetryTrackerRoomClient],
                    encodedUpdate.length,
                    'received',
                );
            }
        } catch (err) {
            if (!(err instanceof TRPCError)) {
                throw new TRPCError({
                    code: 'INTERNAL_SERVER_ERROR',
                    message: 'failed to publish update',
                });
            }
            throw err;
        }
    });

export type TDocUpdateMutationProcedure = typeof docUpdateMutationProcedure;
