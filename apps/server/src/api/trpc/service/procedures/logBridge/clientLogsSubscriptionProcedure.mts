import { z } from 'zod';
import { servicePlanePassthroughProcedure } from '../../middleware/passthrough.mjs';
import { ConsoleMessage } from '../../../../../schema/consoleMessage.mjs';

export const clientLogsSubscriptionProcedure = servicePlanePassthroughProcedure.subscription(async function* ({
    signal,
    ctx,
}) {
    for await (const message of ctx.logQueue) {
        yield message as ConsoleMessage;
    }
});

export type TclientLogsSubscriptionProcedure = typeof clientLogsSubscriptionProcedure;
