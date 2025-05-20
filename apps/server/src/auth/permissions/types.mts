import { TPermissions } from '../../schema/config.mjs';

export type PermissionResolverOptions = {
    secretKey?: string;
    token?: string;
    defaultPermission: TPermissions;
};
