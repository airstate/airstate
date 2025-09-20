import { nanoid } from 'nanoid';
import { servicePlanePassthroughProcedure } from '../../middleware/passthrough.mjs';
import { z } from 'zod';
import { runInAction, when } from 'mobx';
import { TRPCError } from '@trpc/server';
import { logger } from '../../../../../logger.mjs';
import { createHash } from 'crypto';
import { createBlockingQueue } from '../../../../../lib/queue/index.mjs';

export type TServerStateMessage =
    | {
          type: 'session-info';
          session_id: string;
      }
    | {
          type: 'init';
      }
    | {
          type: 'updates';
          updates: Array<{
              key: string;
              value: any;
          }>;
      };

export const serverStateSubscriptionProcedure = servicePlanePassthroughProcedure
    .input(z.object({}))
    .subscription(async function* ({ input, ctx, signal }) {
        const sessionId = nanoid();
        const hashedSessionId: string = createHash('sha256').update(sessionId).digest('hex');

        runInAction(() => {
            ctx.services.localState.sessionMeta[sessionId] = {
                type: 'server-state',
                keys: new Set(),
            };
        });

        try {
            yield {
                type: 'session-info',
                session_id: sessionId,
            } satisfies TServerStateMessage;

            await when(
                () =>
                    !(sessionId in ctx.services.localState.sessionMeta) ||
                    ctx.services.localState.sessionMeta[sessionId].type !== 'server-state' ||
                    !!ctx.services.localState.sessionMeta[sessionId].meta,
                {
                    signal: signal,
                },
            );

            if (!(sessionId in ctx.services.localState.sessionMeta)) {
                return;
            }

            const session = ctx.services.localState.sessionMeta[sessionId];

            if (session.type !== 'server-state') {
                throw new TRPCError({
                    code: 'CONFLICT',
                    message: `the initialized session type for sessionId "${sessionId}" was "${session.type}"; expected "server-state"`,
                });
            }

            logger.debug(`new subscription for server-state: ${ctx.clientId}`, {
                clientId: ctx.clientId,
            });

            const messageQueue = createBlockingQueue<TServerStateMessage | Error | null>();

            session.handler = (stateKey: string, value: any, origin?: string) => {
                logger.debug(`new value for "${stateKey}"`, {
                    stateKey: stateKey,
                    stateValue: value,
                    emitOrigin: origin,
                });

                messageQueue.enqueue({
                    type: 'updates',
                    updates: [
                        {
                            key: stateKey,
                            value: value,
                        },
                    ],
                });
            };

            yield {
                type: 'init',
            } as TServerStateMessage;

            while (true) {
                const message = await messageQueue.dequeue();

                if (message instanceof Error) {
                    throw message;
                } else if (message === null) {
                    break;
                } else {
                    yield message satisfies TServerStateMessage;
                }
            }
        } catch (error) {
        } finally {
            delete ctx.services.localState.sessionMeta[sessionId];
        }
    });

export type TServerStateSubscriptionProcedure = typeof serverStateSubscriptionProcedure;
