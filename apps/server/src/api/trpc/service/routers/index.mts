import { servicePlanePublicProcedure, servicePlaneRouter } from '../index.mjs';
import { TYJSRouter, yjsRouter } from './yjs.mjs';

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
});

export type TServicePlaneAppRouter = typeof servicePlaneAppRouter;
