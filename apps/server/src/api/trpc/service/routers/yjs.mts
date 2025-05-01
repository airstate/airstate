import { servicePlaneRouter } from '../index.mjs';
import { docUpdatesSubscriptionProcedure } from '../procedures/yjs/docUpdatesSubscriptionProcedure.mjs';
import { docUpdateMutationProcedure } from '../procedures/yjs/docUpdateMutationProcedure.mjs';

export const yjsRouter = servicePlaneRouter({
    docUpdates: docUpdatesSubscriptionProcedure,
    docUpdate: docUpdateMutationProcedure,
});

export type TYJSRouter = typeof yjsRouter;
