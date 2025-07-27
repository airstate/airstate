export interface HookPayloads {
    clientConnected: {
        type: 'clientConnected';
        clientId: string;
        namespace: string;
        appId: string | null;
        groups?: string[];
    };
    clientDisconnected: {
        type: 'clientDisconnected';
        clientId: string;
        namespace: string;
        appId: string | null;
        groups?: string[];
    };
    documentCreated: {
        type: 'documentCreated';
        documentId: string;
        namespace: string;
        appId: string | null;
        labels?: string[];
    };
    roomCreated: {
        type: 'roomCreated';
        roomId: string;
        namespace: string;
        appId: string | null;
        labels?: string[];
    };
    clientSubscribed:
        | {
              type: 'clientSubscribed';
              service: 'presence';
              roomId: string;
              clientId: string;
              namespace: string;
              appId: string | null;
              groups?: string[];
          }
        | {
              type: 'clientSubscribed';
              service: 'ydoc';
              documentId: string;
              clientId: string;
              namespace: string;
              appId: string | null;
              groups?: string[];
          };
    clientUnsubscribed:
        | {
              type: 'clientUnsubscribed';
              service: 'presence';
              roomId: string;
              clientId: string;
              namespace: string;
              appId: string | null;
              groups?: string[];
          }
        | {
              type: 'clientUnsubscribed';
              service: 'ydoc';
              documentId: string;
              clientId: string;
              namespace: string;
              appId: string | null;
              groups?: string[];
          };
}

export interface HookResponsePayloads {
    clientConnected: {
        drop?: boolean;
        reason?: string;
    };
    clientSubscribed: {
        drop?: boolean;
        reason?: string;
    };
    clientDisconnected: void;
    documentCreated: void;
    roomCreated: void;
    clientUnsubscribed: void;
}
