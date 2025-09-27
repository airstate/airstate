import { servicePlanePassthroughProcedure } from '../../middleware/passthrough.mjs';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { atom } from 'synchronization-atom';
import { logger } from '../../../../../logger.mjs';

export const watchKeysMutationProcedure = servicePlanePassthroughProcedure
    .input(
        z.object({
            sessionId: z.string(),
            keys: z.string().array(),
        }),
    )
    .mutation(async ({ input, ctx }) => {
        const sessionId = input.sessionId;
        const sessions = ctx.services.localState.sessionMeta;

        if (!(sessionId in sessions)) {
            throw new TRPCError({
                code: 'NOT_FOUND',
                message: 'session not found',
            });
        }

        const session = sessions[sessionId];

        if (session.type !== 'server-state') {
            throw new TRPCError({
                code: 'CONFLICT',
                message: 'session is not a server-state session',
            });
        }

        if (!session.handler) {
            throw new TRPCError({
                code: 'FORBIDDEN',
                message: 'session is not initialized yet',
            });
        }

        logger.debug(`server-state: watch request for session "${sessionId}"`, {
            sessionId: sessionId,
            watchKeys: input.keys,
        });

        const channels = ctx.services.ephemeralState.service.serverState.channels;

        const subscribe = async (stateKey: string) => {
            const subscriptionKey = `${ctx.namespace}:${stateKey}`;

            const channelKey = `server-state:update:${subscriptionKey}`;
            const dataKey = `server-state:data:${subscriptionKey}`;

            if (!(channelKey in channels)) {
                channels[channelKey] = {
                    channelKey: channelKey,
                    subscriptionKey: subscriptionKey,

                    stateKey: stateKey,

                    subscriptionListeners: new Set(),
                    lock: atom(false),
                };
            }

            const channel = channels[channelKey];

            // acquire lock
            await channel.lock.conditionallyUpdate((state) => state === false, true);

            channel.subscriptionListeners.add(session.handler!);

            if (channel.subscriptionListeners.size === 1) {
                await ctx.services.valkeySubscription.subscribe(channelKey);
            }

            session.keys.add(stateKey);

            // release lock
            await channel.lock.conditionallyUpdate(() => true, false);

            const rawData = await ctx.services.valkey.get(dataKey);
            const data = rawData === null ? null : JSON.parse(rawData);

            session.handler?.(stateKey, data, 'watch-keys-initial-value');

            return {
                key: stateKey,
                value: data,
            };
        };

        const resultList = await Promise.all(input.keys.map((key) => subscribe(key)));

        return Object.fromEntries(resultList.map((result) => [result.key, result]));
    });

export type TWatchKeysMutationProcedure = typeof watchKeysMutationProcedure;
