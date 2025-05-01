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
            read: defaultPermission?.yjs?.read ?? env.DEFAULT_YJS_READ_PERMISSION.toLowerCase() === 'true',
            write: defaultPermission?.yjs?.write ?? env.DEFAULT_YJS_WRITE_PERMISSION.toLowerCase() === 'true',
        },
        presence: {
            join: defaultPermission?.presence?.join ?? env.DEFAULT_PRESENCE_JOIN_PERMISSION.toLowerCase() === 'true',
            update_state:
                defaultPermission?.presence?.update_state ??
                env.DEFAULT_PRESENCE_UPDATE_STATE_PERMISSION.toLowerCase() === 'true',
            read_presence:
                defaultPermission?.presence?.read_presence ??
                env.DEFAULT_PRESENCE_READ_PRESENCE_PERMISSION.toLowerCase() === 'true',
            read_last: defaultPermission?.presence?.read_last ?? parseInt(env.DEFAULT_PRESENCE_READ_LAST_PERMISSION),
            read_summary:
                defaultPermission?.presence?.read_summary ??
                env.DEFAULT_PRESENCE_READ_SUMMARY_PERMISSION.toLowerCase() === 'true',
        },
    };

    return {
        yjs: {
            read: permissionFromToken?.yjs?.read ?? effectiveDefaultPermissions.yjs.read,
            write: permissionFromToken?.yjs?.write ?? effectiveDefaultPermissions.yjs.write,
        },
        presence: {
            join: permissionFromToken?.presence?.join ?? effectiveDefaultPermissions.presence.join,
            update_state:
                permissionFromToken?.presence?.update_state ?? effectiveDefaultPermissions.presence.update_state,
            read_presence:
                permissionFromToken?.presence?.read_presence ?? effectiveDefaultPermissions.presence.read_presence,
            read_last: permissionFromToken?.presence?.read_last ?? effectiveDefaultPermissions.presence.read_last,
            read_summary:
                permissionFromToken?.presence?.read_summary ?? effectiveDefaultPermissions.presence.read_summary,
        },
    };
}
