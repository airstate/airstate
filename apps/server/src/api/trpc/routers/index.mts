import { publicProcedure, router } from '../index.mjs';
import { sharedStateRouter, TSharedStateRouter } from './shared-state.mjs';

// note: all delegated routers are cast to their own type with
//       `as` to work around TypeScript's maximum type inference
//       depth limits.

export const appRouter = router({
    _: publicProcedure.query(async ({ ctx, input }) => {
        return {
            message: "HELLO FROM AirState's tRPC SERVER!",
        };
    }),
    sharedState: sharedStateRouter as TSharedStateRouter,
});

export type TAppRouter = typeof appRouter;
