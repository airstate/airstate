import { publicProcedure, router } from '../index.mjs';
import { TYJSRouter, yjsRouter } from './yjs.mjs';

// note: all delegated routers are cast to their own type with
//       `as` to work around TypeScript's maximum type inference
//       depth limits.

export const appRouter = router({
    _: publicProcedure.query(async ({ ctx, input }) => {
        return {
            message: "HELLO FROM AirState's tRPC SERVER!",
        };
    }),
    yjs: yjsRouter as TYJSRouter,
});

export type TAppRouter = typeof appRouter;
