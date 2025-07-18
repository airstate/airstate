import { controlPlanePublicProcedure } from '../../index.mjs';

export const getInfoProcedure = controlPlanePublicProcedure.query(async ({ ctx }) => {
    return {
        runId: ctx.services.info.runId,
    };
});
