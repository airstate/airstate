import * as y from 'yjs';

export class RemoteOrigin {
    constructor(
        public readonly reason: 'sync' | 'update',
        public readonly client?: string,
    ) {}
}

export class AirStateInitialStateUndoManager extends y.UndoManager {}
