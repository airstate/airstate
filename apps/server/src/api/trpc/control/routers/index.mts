import { controlPlanePublicProcedure, controlPlaneRouter } from '../index.mjs';

// note: all delegated routers are cast to their own type with
//       `as` to work around TypeScript's maximum type inference
//       depth limits.

export const controlPlaneAppRouter = controlPlaneRouter({
    _: controlPlanePublicProcedure.query(async ({ ctx, input }) => {
        return {
            message: 'HELLO FROM AirState control-plane tRPC SERVER',
        };
    }),
});

export type TControlPlaneAppRouter = typeof controlPlaneAppRouter;
