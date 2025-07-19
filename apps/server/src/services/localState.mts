import { makeAutoObservable } from 'mobx';
import { TPermissions } from '../schema/config.mjs';

export type TLocalState = {
    sessionMeta: {
        [sessionId: string]:
            | {
                  type: 'yjs';

                  documentId: string;
                  hashedDocumentId: string;

                  meta?: {
                      permissions: TPermissions['yjs'];
                  };
              }
            | {
                  type: 'presence';

                  roomId: string;
                  hashedRoomId: string;

                  meta?: {
                      peerId: string;
                      hashedPeerId: string;

                      permissions: TPermissions['presence'];
                  };
              };
    };
};

export async function createLocalState() {
    return makeAutoObservable<TLocalState>(
        {
            sessionMeta: {},
        },
        {},
        {
            autoBind: true,
            deep: true,
        },
    );
}

export type TLocalStateService = {
    localState: Awaited<ReturnType<typeof createLocalState>>;
};
