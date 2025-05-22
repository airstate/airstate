import { servicePlaneRouter } from '../index.mjs';
import {
    roomUpdatesSubscriptionProcedure,
    TRoomUpdatesSubscriptionProcedure,
} from '../procedures/presence/roomUpdatesSubscriptionProcedure.mjs';
import {
    peerInitMutationProcedure,
    TPeerInitMutationProcedure,
} from '../procedures/presence/peerInitMutationProcedure.mjs';

export const presenceRouter = servicePlaneRouter({
    roomUpdates: roomUpdatesSubscriptionProcedure as TRoomUpdatesSubscriptionProcedure,
    peerInit: peerInitMutationProcedure as TPeerInitMutationProcedure,
});

export type TPresenceRouter = typeof presenceRouter;
