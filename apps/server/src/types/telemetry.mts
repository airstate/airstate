export type TTelemetryClient = {
    browser: string;
    os: string;
    country: string;
    connection_time_s: number;

    clientPageHostname: string;
    serverHostname: string;
};

export type TTelemetryRoom = {
    roomType: 'presence' | 'ydoc';
    active_for_s: number;

    average_messages_sent_per_client: number;
    average_messages_received_per_client: number;
    average_data_uploaded_per_client: number;
    average_data_downloaded_per_client: number;
    average_subscription_time_per_client_s: number;

    median_messages_sent_per_client: number;
    median_messages_received_per_client: number;
    median_data_uploaded_per_client: number;
    median_data_downloaded_per_client: number;
    median_subscription_time_per_client_s: number;
};

export type TTelemetryPayload = {
    version: string;

    runID: string;
    clusterID: string;
    hashedHostname: string;

    clients: {
        [hashedClientID: string]: TTelemetryClient;
    };

    rooms: {
        [hashedRoomID: string]: TTelemetryRoom;
    };

    clientHostnames: string[];
    serverHostnames: string[];
};

export type TTelemetryTracker = {
    clients: {
        [clientId: string]: {
            clientID: string;
            hashedClientID: string;

            browser: string;
            os: string;
            country: string;

            serverHostname: string;
            clientPageHostname: string;

            firstActivityTimestamp: number;
            lastActivityTimestamp: number;

            services: {
                ydoc: {
                    totalUpdatesReceivedFromClient: number;
                    totalBytesReceivedFromClient: number;

                    totalUpdatesSentToClient: number;
                    totalBytesSentToClient: number;
                };

                presence: {
                    totalUpdatesReceivedFromClient: number;
                    totalBytesReceivedFromClient: number;

                    totalUpdatesSentToClient: number;
                    totalBytesSentToClient: number;
                };
            };
        };
    };

    services: {
        ydoc: {
            documents: {
                [documentId: string]: {
                    documentId: string;
                    hashedDocumentId: string;

                    firstActivityTimestamp: number;
                    lastActivityTimestamp: number;

                    totalUpdatesReceivedFromClients: number;
                    totalBytesReceivedFromClients: number;

                    totalUpdatesSentToClients: number;
                    totalBytesSentToClients: number;

                    clients: {
                        [clientId: string]: {
                            clientId: string;
                            hashedClientId: string;

                            firstActivityTimestamp: number;
                            lastActivityTimestamp: number;

                            totalUpdatesReceivedFromClient: number;
                            totalBytesReceivedFromClient: number;

                            totalUpdatesSentToClient: number;
                            totalBytesSentToClient: number;
                        };
                    };
                };
            };
        };

        presence: {
            rooms: {
                [roomId: string]: {
                    roomId: string;
                    hashedRoomId: string;

                    firstActivityTimestamp: number;
                    lastActivityTimestamp: number;

                    totalUpdatesReceivedFromClients: number;
                    totalBytesReceivedFromClients: number;

                    totalUpdatesSentToClients: number;
                    totalBytesSentToClients: number;

                    clients: {
                        [clientId: string]: {
                            clientId: string;
                            hashedClientId: string;

                            firstActivityTimestamp: number;
                            lastActivityTimestamp: number;

                            totalUpdatesReceivedFromClient: number;
                            totalBytesReceivedFromClient: number;

                            totalUpdatesSentToClient: number;
                            totalBytesSentToClient: number;
                        };
                    };
                };
            };
        };
    };
};

const JSONLResponse = [
    ['ydoc', 5],
    [
        'client_id',
        'room_id',
        'groups',
        'app_key',
        'total_bytes_sent_to_client',
        'total_bytes_received_from_client',
        'total_updates_sent_to_client',
        'total_updates_received_from_client',
    ],
    ['cid', 'rid', 'aid', 'ak', 1, 2, 3, 4],
    ['cid', 'rid', 'aid', 'ak', 1, 2, 3, 4],
    ['cid', 'rid', 'aid', 'ak', 1, 2, 3, 4],
    ['cid', 'rid', 'aid', 'ak', 1, 2, 3, 4],
    ['cid', 'rid', 'aid', 'ak', 1, 2, 3, 4],
    ['presence', 4],
    [
        'client_id',
        'room_id',
        'account_id',
        'app_key',
        'total_bytes_sent_to_client',
        'total_bytes_received_from_client',
        'total_updates_sent_to_client',
        'total_updates_received_from_client',
    ],
    ['cid', 'rid', 'aid', 'ak', 1, 2, 3, 4],
    ['cid', 'rid', 'aid', 'ak', 1, 2, 3, 4],
    ['cid', 'rid', 'aid', 'ak', 1, 2, 3, 4],
    ['cid', 'rid', 'aid', 'ak', 1, 2, 3, 4],
];
