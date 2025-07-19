import { servicePlanePublicProcedure, servicePlaneRouter } from '../index.mjs';
import { TYJSRouter, yjsRouter } from './yjs.mjs';
import { presenceRouter, TPresenceRouter } from './presence.mjs';
import {
    clientLogsSubscriptionProcedure,
    TClientLogsSubscriptionProcedure,
} from '../procedures/logBridge/clientLogsSubscriptionProcedure.mjs';
// note: all delegated routers are cast to their own type with
//       `as` to work around TypeScript's maximum type inference
//       depth limits.

export const servicePlaneAppRouter = servicePlaneRouter({
    _: servicePlanePublicProcedure.query(async ({ ctx, input }) => {
        return {
            message: 'HELLO FROM AirState service-plane tRPC SERVER',
        };
    }),
    yjs: yjsRouter as TYJSRouter,
    presence: presenceRouter as TPresenceRouter,
    clientLogsSubscriptionProcedure: clientLogsSubscriptionProcedure as TClientLogsSubscriptionProcedure,
});

export type TServicePlaneAppRouter = typeof servicePlaneAppRouter;
