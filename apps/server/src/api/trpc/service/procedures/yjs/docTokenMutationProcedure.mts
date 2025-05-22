import { z } from 'zod';
import { servicePlanePassthroughProcedure } from '../../middleware/passthrough.mjs';
import { resolvePermissions } from '../../../../../auth/permissions/index.mjs';
import { sessionStore } from '../../../../../services/sessionStore.mjs';

export const docTokenMutationProcedure = servicePlanePassthroughProcedure
    .meta({ writePermissionRequired: true })
    .input(
        z.object({
            sessionID: z.string(),
            token: z.string().nullable(),
        }),
    )
    .mutation(async function ({ ctx, input }) {
        const permission = resolvePermissions({
            secretKey: ctx.appSecret,
            token: input.token,
            defaultPermission: ctx.permissions,
        });

        sessionStore.setSessionData(input.sessionID, {
            token: input.token,
            permissions: permission,
        });

        return null as any;
    });

export type TDocTokenMutationProcedure = typeof docTokenMutationProcedure;
