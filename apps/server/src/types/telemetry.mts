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
        [clientID: string]: {
            clientID: string;
            hashedClientID: string;

            browser: string;
            os: string;
            country: string;

            serverHostname: string;
            clientPageHostname: string;

            firstActivityTimestamp: number;
            lastActivityTimestamp: number;

            totalMessagesReceived: number;
            totalMessagesRelayed: number;

            totalBytesReceived: number;
            totalBytesRelayed: number;
        };
    };

    rooms: {
        [roomID: string]: {
            roomID: string;
            hashedRoomID: string;

            roomType: 'presence' | 'ydoc';

            firstActivityTimestamp: number;
            lastActivityTimestamp: number;

            totalMessagesReceived: number;
            totalMessagesRelayed: number;

            totalBytesReceived: number;
            totalBytesRelayed: number;

            clients: {
                [clientID: string]: {
                    clientID: string;
                    hashedClientID: string;

                    firstActivityTimestamp: number;
                    lastActivityTimestamp: number;

                    totalMessagesReceived: number;
                    totalMessagesRelayed: number;

                    totalBytesReceived: number;
                    totalBytesRelayed: number;
                };
            };
        };
    };
};
