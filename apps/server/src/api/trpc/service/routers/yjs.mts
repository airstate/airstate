import { servicePlaneRouter } from '../index.mjs';
import {
    docUpdatesSubscriptionProcedure,
    TDocUpdatesSubscriptionProcedure,
} from '../procedures/yjs/docUpdatesSubscriptionProcedure.mjs';
import {
    docUpdateMutationProcedure,
    TDocUpdateMutationProcedure,
} from '../procedures/yjs/docUpdateMutationProcedure.mjs';
import { docInitMutationProcedure, TDocInitMutationProcedure } from '../procedures/yjs/docInitMutationProcedure.mjs';

export const yjsRouter = servicePlaneRouter({
    docUpdates: docUpdatesSubscriptionProcedure as TDocUpdatesSubscriptionProcedure,
    docUpdate: docUpdateMutationProcedure as TDocUpdateMutationProcedure,
    docInit: docInitMutationProcedure as TDocInitMutationProcedure,
});

export type TYJSRouter = typeof yjsRouter;
