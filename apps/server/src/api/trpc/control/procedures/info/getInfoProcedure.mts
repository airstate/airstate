import { controlPlanePublicProcedure } from '../../index.mjs';

export const getInfoProcedure = controlPlanePublicProcedure.query(async ({ ctx }) => {
    return {
        ephemeral_id: ctx.services.info.ephemeral_id,
    };
});
