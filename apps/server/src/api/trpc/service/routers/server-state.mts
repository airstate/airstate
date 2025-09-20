import { servicePlaneRouter } from '../index.mjs';
import {
    clientInitMutationProcedure,
    TClientInitMutationProcedure,
} from '../procedures/server-state/clientInitMutationProcedure.mjs';
import {
    serverStateSubscriptionProcedure,
    TServerStateSubscriptionProcedure,
} from '../procedures/server-state/serverStateSubscriptionProcedure.mjs';
import {
    TUnwatchKeysMutationProcedure,
    unwatchKeysMutationProcedure,
} from '../procedures/server-state/unwatchKeysMutationProcedure.mjs';
import {
    TWatchKeysMutationProcedure,
    watchKeysMutationProcedure,
} from '../procedures/server-state/watchKeysMutationProcedure.mjs';

export const serverStateRouter = servicePlaneRouter({
    // mutations
    clientInit: clientInitMutationProcedure as TClientInitMutationProcedure,
    watchKeys: watchKeysMutationProcedure as TWatchKeysMutationProcedure,
    unwatchKeys: unwatchKeysMutationProcedure as TUnwatchKeysMutationProcedure,

    // subscriptions
    serverState: serverStateSubscriptionProcedure as TServerStateSubscriptionProcedure,
});

export type TServerStateRouter = typeof serverStateRouter;
