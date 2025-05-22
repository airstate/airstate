import { servicePlaneRouter } from '../index.mjs';
import { docUpdatesSubscriptionProcedure } from '../procedures/yjs/docUpdatesSubscriptionProcedure.mjs';
import { docUpdateMutationProcedure } from '../procedures/yjs/docUpdateMutationProcedure.mjs';
import { docTokenMutationProcedure } from '../procedures/yjs/docTokenMutationProcedure.mjs';

export const yjsRouter = servicePlaneRouter({
    docUpdates: docUpdatesSubscriptionProcedure,
    docUpdate: docUpdateMutationProcedure,
    docToken: docTokenMutationProcedure,
});

export type TYJSRouter = typeof yjsRouter;
