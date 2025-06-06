export type TTelemetryPayload = {
    clients: {
        [hashedClientID: string]: {
            browser: string;
            os: string;
            country: string;
            connection_time_s: number;
        };
    };

    rooms: {
        [hashedRoomID: string]: {
            roomType: 'presence' | 'ydoc';
            active_for_s: number;
            average_messages_sent_per_client: number;
            average_messages_received_per_client: number;
            average_data_uploaded_per_client: number;
            average_data_downloaded_per_client: number;
            average_subscription_time_per_client_s: number;
        };
    };

    domains: string[];
};
