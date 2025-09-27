export type TMetricsTracker = {
    services: {
        ydoc: {
            documents: {
                [documentId: string]: {
                    documentId: string;
                    labels?: string[];

                    clients: {
                        [clientId: string]: {
                            clientId: string;
                            namespace: string;
                            appId: string | null;
                            groups?: string[];

                            totalUpdatesReceivedFromClients: number;
                            totalBytesReceivedFromClients: number;

                            totalUpdatesSentToClients: number;
                            totalBytesSentToClients: number;
                        };
                    };
                };
            };
        };

        presence: {
            rooms: {
                [roomId: string]: {
                    roomId: string;
                    labels?: string[];
                    clients: {
                        [clientId: string]: {
                            clientId: string;
                            namespace: string;
                            appId: string | null;
                            groups?: string[];

                            totalUpdatesReceivedFromClients: number;
                            totalBytesReceivedFromClients: number;

                            totalUpdatesSentToClients: number;
                            totalBytesSentToClients: number;
                        };
                    };
                };
            };
        };
    };
};
