export class RemoteOrigin {
    constructor(
        public readonly reason: 'sync' | 'update',
        public readonly client?: string,
    ) {}
}
