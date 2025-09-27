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
              }
            | {
                  type: 'server-state';

                  keys: Set<string>;
                  handler?: (stateKey: string, data: any, origin?: string) => void;

                  meta?: {};
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
