import { controlPlanePublicProcedure, controlPlaneRouter } from '../index.mjs';
import { getInfoProcedure, TGetInfoProcedure } from '../procedures/info/getInfoProcedure.mjs';
import { presenceSubscriptionProcedure, TPresenceSubscriptProcedure } from '../procedures/presence/presence.mjs';

// note: all delegated routers are cast to their own type with
//       `as` to work around TypeScript's maximum type inference
//       depth limits.

export const controlPlaneAppRouter = controlPlaneRouter({
    _: controlPlanePublicProcedure.query(async ({ ctx, input }) => {
        return {
            message: 'HELLO FROM AirState control-plane tRPC SERVER',
        };
    }),
    info: getInfoProcedure as TGetInfoProcedure,
    presence: presenceSubscriptionProcedure as TPresenceSubscriptProcedure,
});

export type TControlPlaneAppRouter = typeof controlPlaneAppRouter;
