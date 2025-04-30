import { env } from '../../env.mjs';
import type { PermissionResolverOptions, ResolvedPermission } from './types.mjs';
import jwt from 'jsonwebtoken';
import { tokenPayloadSchema } from '../../schema/tokenPayload.mjs';
import { logger } from '../../logger.mjs';

function validateToken(token: string, signingSecret: string) {
    try {
        const decodedToken = jwt.verify(token, signingSecret);
        const parsedToken = tokenPayloadSchema.parse(decodedToken);
        return parsedToken.yjs;
    } catch (error) {
        logger.error(`Token validation failed`, error);
        return null;
    }
}

export function resolvePermission({
    secretKey,
    token,
    defaultPermission,
}: PermissionResolverOptions): ResolvedPermission {
    const permissionFromToken = token && secretKey ? validateToken(token, secretKey) : null;

    const effectiveDefaultPermission = {
        read: defaultPermission ? defaultPermission.read : env.DEFAULT_PERMISSION !== 'none',
        write: defaultPermission ? defaultPermission.write : env.DEFAULT_PERMISSION === 'read-write',
    };

    return {
        read: permissionFromToken ? permissionFromToken.read : effectiveDefaultPermission.read,
        write: permissionFromToken ? permissionFromToken.write : effectiveDefaultPermission.write,
    };
}
