import { env } from '../../env.mjs';
import type { PermissionResolverOptions } from './types.mjs';
import jwt from 'jsonwebtoken';
import { tokenPayloadSchema } from '../../schema/tokenPayload.mjs';
import { logger } from '../../logger.mjs';
import { TPermissions } from '../../schema/config.mjs';
import { merge } from 'es-toolkit/object';

export function extractTokenPayload(token: string, signingSecret: string) {
    try {
        const decodedToken = jwt.verify(token, signingSecret);
        return tokenPayloadSchema.parse(decodedToken);
    } catch (error) {
        logger.error(`token validation failed`, error);
        return null;
    }
}

export function resolvePermissions({ secretKey, token, defaultPermission }: PermissionResolverOptions): TPermissions {
    const permissionFromToken = token && secretKey ? extractTokenPayload(token, secretKey)?.permissions : null;
    return permissionFromToken ? merge(defaultPermission, permissionFromToken) : defaultPermission;
}
