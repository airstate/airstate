export type DefaultPermission =
    | {
          read: boolean;
          write: boolean;
      }
    | undefined;

export type PermissionResolverOptions = {
    secretKey: string | undefined;
    token: string | undefined;
    defaultPermission: DefaultPermission;
};

export type ResolvedPermission = {
    read: boolean;
    write: boolean;
};
