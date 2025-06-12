import { z } from 'zod';
import { createHash } from 'node:crypto';
import { headers } from 'nats';
import { TRPCError } from '@trpc/server';
import { servicePlanePassthroughProcedure } from '../../middleware/passthrough.mjs';
import { resolvePermissions } from '../../../../../auth/permissions/index.mjs';
import { initTelemetryTrackerRoom } from '../../../../../utils/telemetry/rooms.mjs';
import { initTelemetryTrackerClient } from '../../../../../utils/telemetry/clients.mjs';

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
        // TODO: check permissions based on the sessionID

        console.log('server received update for session', input.sessionID);

        const clientSentKey = input.key;
        const hashedClientSentKey: string = createHash('sha256').update(clientSentKey).digest('hex');

        const key = `${ctx.accountID}__${hashedClientSentKey}`;
        const subject = `yjs.${key}`;

        const telemetryTrackerRoom = initTelemetryTrackerRoom(ctx.services.ephemeralState.telemetryTracker, key);
        const telemetryTrackerClient = await initTelemetryTrackerClient(ctx.services.ephemeralState.telemetryTracker, {
            id: ctx.clientSentClientID ?? '',
            ipAddress: ctx.clientIPAddress ?? '0.0.0.0',
            userAgentString: ctx.clientUserAgentString ?? 'unknown',
            serverHostname: ctx.serverHostname ?? 'unknown',
            clientPageHostname: ctx.clientPageHostname ?? 'unknown',
        });

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

                telemetryTrackerRoom.totalMessagesReceived += 1;
                telemetryTrackerRoom.totalBytesReceived += encodedUpdate.length;
                telemetryTrackerRoom.lastActivityTimestamp = Date.now();

                telemetryTrackerClient.totalMessagesReceived += 1;
                telemetryTrackerClient.totalBytesReceived += encodedUpdate.length;
                telemetryTrackerClient.lastActivityTimestamp = Date.now();
            }
        } catch (err) {
            throw new TRPCError({
                code: 'INTERNAL_SERVER_ERROR',
                message: 'failed to publish update',
            });
        }
    });

export type TDocUpdateMutationProcedure = typeof docUpdateMutationProcedure;
