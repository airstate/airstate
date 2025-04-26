import { publicProcedure } from '../index.mjs';

export const shareStateProcedure = publicProcedure.subscription(async function* ({ ctx, input, signal }) {
    return null as any;
});

export type TShareStateProcedure = typeof shareStateProcedure;
