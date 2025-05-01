import { env } from '../../env.mjs';
import type { PermissionResolverOptions } from './types.mjs';
import jwt from 'jsonwebtoken';
import { tokenPayloadSchema } from '../../schema/tokenPayload.mjs';
import { logger } from '../../logger.mjs';
import { TPermissions } from '../../schema/config.mjs';

function validateToken(token: string, signingSecret: string) {
    try {
        const decodedToken = jwt.verify(token, signingSecret);
        return tokenPayloadSchema.parse(decodedToken);
    } catch (error) {
        logger.error(`token validation failed`, error);
        return null;
    }
}

export function resolvePermissions({
    secretKey,
    token,
    defaultPermission,
}: PermissionResolverOptions): Required<TPermissions> {
    const permissionFromToken = token && secretKey ? validateToken(token, secretKey)?.permissions : null;

    const effectiveDefaultPermissions: Required<TPermissions> = {
        yjs: {
            read: defaultPermission?.yjs?.read ?? env.DEFAULT_YJS_PERMISSION !== 'none',
            write: defaultPermission?.yjs?.write ?? env.DEFAULT_YJS_PERMISSION === 'read-write',
        },
        presence: {
            show:
                (defaultPermission?.presence?.show ?? env.DEFAULT_PRESENCE_PERMISSION === 'all')
                    ? -1
                    : env.DEFAULT_PRESENCE_PERMISSION === 'none'
                      ? 0
                      : parseInt(env.DEFAULT_PRESENCE_PERMISSION),
            summary: env.DEFAULT_PRESENCE_PERMISSION !== 'none',
        },
    };

    return {
        yjs: {
            read: permissionFromToken?.yjs?.read ?? effectiveDefaultPermissions.yjs.read,
            write: permissionFromToken?.yjs?.write ?? effectiveDefaultPermissions.yjs.write,
        },
        presence: {
            show: permissionFromToken?.presence?.show ?? effectiveDefaultPermissions.presence?.show,
            summary: permissionFromToken?.presence?.summary ?? effectiveDefaultPermissions.presence?.summary,
        },
    };
}
