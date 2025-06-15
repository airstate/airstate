import { controlPlanePublicProcedure } from '../../index.mjs';

export const getInfoProcedure = controlPlanePublicProcedure.query(async ({ ctx }) => {
    return {
        runID: ctx.services.info.runID,
    };
});
