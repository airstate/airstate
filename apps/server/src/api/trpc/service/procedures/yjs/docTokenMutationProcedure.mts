import { z } from 'zod';
import { createHash } from 'node:crypto';
import { headers } from 'nats';
import { TRPCError } from '@trpc/server';
import { servicePlanePassthroughProcedure } from '../../middleware/passthrough.mjs';
import { resolvePermissions } from '../../../../../auth/permissions/index.mjs';

export const docTokenMutationProcedure = servicePlanePassthroughProcedure
    .meta({ writePermissionRequired: true })
    .input(
        z.object({
            sessionID: z.string(),
            token: z.string(),
        }),
    )
    .mutation(async function ({ ctx, input }) {
        // TODO: this. (write the token to a common mobx or something)
        return null as any;
    });

export type TDocTokenMutationProcedure = typeof docTokenMutationProcedure;
