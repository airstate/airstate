import { router } from '../index.mjs';
import { shareStateProcedure } from '../procedures/shareState.mjs';

export const sharedStateRouter = router({
    shareState: shareStateProcedure,
});

export type TSharedStateRouter = typeof sharedStateRouter;
