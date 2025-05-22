import { servicePlaneRouter } from '../index.mjs';
import {
    roomUpdatesSubscriptionProcedure,
    TRoomUpdatesSubscriptionProcedure,
} from '../procedures/presence/roomUpdatesSubscriptionProcedure.mjs';
import {
    peerInitMutationProcedure,
    TPeerInitMutationProcedure,
} from '../procedures/presence/peerInitMutationProcedure.mjs';
import {
    presenceUpdateMutationProcedure,
    TPresenceUpdateMutationProcedure,
} from '../procedures/presence/presenceUpdateMutationProcedure.mjs';

export const presenceRouter = servicePlaneRouter({
    roomUpdates: roomUpdatesSubscriptionProcedure as TRoomUpdatesSubscriptionProcedure,
    peerInit: peerInitMutationProcedure as TPeerInitMutationProcedure,
    update: presenceUpdateMutationProcedure as TPresenceUpdateMutationProcedure,
});

export type TPresenceRouter = typeof presenceRouter;
