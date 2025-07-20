export type THookEvent =
    | {
          event_type: 'presence.room.created';
          data: {
              roomId: string;
              namespace: string;
              appId: string;
              labels?: string[];
          };
          eventTime: number;
      }
    | {
          event_type: 'ydoc.document.created';
          data: {
              documentId: string;
              namespace: string;
              appId: string;
              labels?: string[];
          };
          eventTime: number;
      }
    | {
          event_type: 'client.connected';
          data:
              | {
                    service: 'presence';
                    roomId: string;
                    clientId: string;
                    namespace: string;
                    appId: string;
                    groups?: string[];
                }
              | {
                    service: 'ydoc';
                    documentId: string;
                    clientId: string;
                    namespace: string;
                    appId: string;
                    groups?: string[];
                };

          eventTime: number;
      }
    | {
          event_type: 'client.disconnected';
          data:
              | {
                    service: 'presence';
                    roomId: string;
                    clientId: string;
                    namespace: string;
                    appId: string;
                    groups?: string[];
                }
              | {
                    service: 'ydoc';
                    documentId: string;
                    clientId: string;
                    namespace: string;
                    appId: string;
                    groups?: string[];
                };

          eventTime: number;
      };
