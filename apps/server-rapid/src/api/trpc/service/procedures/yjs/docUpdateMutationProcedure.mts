import { z, ZodType } from 'zod';
import { createHash } from 'node:crypto';
import { headers } from 'nats';
import { TRPCError } from '@trpc/server';
import { servicePlanePassthroughProcedure } from '../../middleware/passthrough.mjs';
import { resolvePermissions } from '../../../../../auth/permissions/index.mjs';
//import { initMetricsTrackerClient } from '../../../../../utils/metric/clients.mjs';
//import { incrementMetricsTracker } from '../../../../../utils/metric/increment.mjs';
// import { initTelemetryTrackerRoom } from '../../../../../utils/telemetry/rooms.mjs';
// import { initTelemetryTrackerClient, initTelemetryTrackerRoomClient } from '../../../../../utils/telemetry/clients.mjs';
// import { incrementTelemetryTrackers } from '../../../../../utils/telemetry/increment.mjs';

export const docUpdateMutationProcedure = servicePlanePassthroughProcedure
    .meta({ writePermissionRequired: true })
    .input(
        z
            .object({
                encodedUpdates: z.string().array(),
            })
            .and(
                z.union([
                    z.object({
                        key: z.string(),
                    }) as ZodType<{
                        /**
                         * @deprecated passing `key` is no longer needed
                         */
                        key: string;
                    }>,
                    z.object({}),
                ]),
            )
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

        if (sessionMeta.type !== 'yjs') {
            throw new TRPCError({
                code: 'CONFLICT',
                message: 'the session is not a yjs session',
            });
        }

        if (!sessionMeta.meta) {
            throw new TRPCError({
                code: 'NOT_FOUND',
                message: 'the session has not been initialized yet',
            });
        }

        if (sessionMeta.meta.permissions.write !== true) {
            throw new TRPCError({
                code: 'FORBIDDEN',
                message: 'the token does not have the permisison to write to this session',
            });
        }

        const documentId = sessionMeta.documentId;
        const hashedDocumentId: string = sessionMeta.hashedDocumentId;

        const key = `${ctx.namespace}__${hashedDocumentId}`;
        const subject = `yjs.${key}`;

        // const telemetryTrackerRoom = initTelemetryTrackerRoom(
        //     ctx.services.ephemeralState.telemetryTracker,
        //     'ydoc',
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

        // const metricsTrackerClient = initMetricsTrackerClient(ctx.services.ephemeralState.metricTracker, {
        //     serviceType: 'ydoc',
        //     containerId: key,
        //     clientId: ctx.clientId,
        //     namespace: ctx.namespace,
        //     appId: ctx.appId,
        // });
        const publishHeaders = headers();
        publishHeaders.set('sessionId', sessionId);

        try {
            for (const encodedUpdate of input.encodedUpdates) {
                await ctx.services.jetStreamClient.publish(
                    subject,
                    ctx.services.natsStringCodec.encode(encodedUpdate),
                    {
                        headers: publishHeaders,
                    },
                );

                // incrementTelemetryTrackers(
                //     [telemetryTrackerRoom, telemetryTrackerClient, telemetryTrackerRoomClient],
                //     encodedUpdate.length,
                //     'received',
                // );

                //incrementMetricsTracker(metricsTrackerClient, encodedUpdate.length, 'received');
            }
        } catch (err) {
            throw new TRPCError({
                code: 'INTERNAL_SERVER_ERROR',
                message: 'failed to publish update',
            });
        }
    });

export type TDocUpdateMutationProcedure = typeof docUpdateMutationProcedure;
