import { TInfoService } from '../services/info.mjs';
import { TTelemetryClient, TTelemetryPayload, TTelemetryRoom, TTelemetryTracker } from '../types/telemetry.mjs';
import { VERSION } from '../version.mjs';

export const TELEMETRY_URL = process.env.TELEMETRY_URL ?? 'https://telemetry.airstate.dev/ingest';

export async function runTelemetryDaemon(telemetryTracker: TTelemetryTracker, services: TInfoService) {
    const { info } = services;

    let runTelemetry = false;

    try {
        const req = await fetch(TELEMETRY_URL, {
            method: 'GET',
        });

        if (req.status === 200) {
            runTelemetry = true;
        }
    } catch {
        runTelemetry = false;
    }

    while (runTelemetry && !('DISABLE_TELEMETRY' in process.env)) {
        try {
            // cleanup clients that have been inactive for more than an hour
            for (const client of Object.values(telemetryTracker.clients)) {
                if (client.lastActivityTimestamp < Date.now() - 1_000 * 60 * 60) {
                    delete telemetryTracker.clients[client.hashedClientID];
                }
            }

            // cleanup rooms that have been inactive for more than an hour
            for (const room of Object.values(telemetryTracker.rooms)) {
                if (room.lastActivityTimestamp < Date.now() - 1_000 * 60 * 60) {
                    delete telemetryTracker.rooms[room.hashedRoomID];
                }
            }

            const clientHostnames = new Set<string>();
            const serverHostnames = new Set<string>();

            for (const client of Object.values(telemetryTracker.clients)) {
                clientHostnames.add(client.clientPageHostname);
                serverHostnames.add(client.serverHostname);
            }

            const telemetryPayload: TTelemetryPayload = {
                version: VERSION,

                runID: info.runID,
                clusterID: info.clusterID,
                hashedHostname: info.hashedHostname,

                clients: Object.fromEntries(
                    Object.values(telemetryTracker.clients).map((client): [string, TTelemetryClient] => {
                        return [
                            client.hashedClientID,
                            {
                                browser: client.browser,
                                os: client.os,
                                country: client.country,
                                connection_time_s:
                                    (client.lastActivityTimestamp - client.firstActivityTimestamp) / 1_000,

                                clientPageHostname: client.clientPageHostname,
                                serverHostname: client.serverHostname,
                            },
                        ];
                    }),
                ),
                rooms: Object.fromEntries(
                    Object.values(telemetryTracker.rooms).map((room): [string, TTelemetryRoom] => {
                        const clients = Object.values(room.clients);

                        const receivedMessageCounts = clients.map((client) => client.totalMessagesReceived);
                        const relayedMessageCounts = clients.map((client) => client.totalMessagesRelayed);
                        const receivedByteCounts = clients.map((client) => client.totalBytesReceived);
                        const relayedByteCounts = clients.map((client) => client.totalBytesRelayed);

                        const subscriptionTimes = clients.map(
                            (client) => client.lastActivityTimestamp - client.firstActivityTimestamp,
                        );

                        const averageSubscriptionTime =
                            subscriptionTimes.reduce((a, b) => a + b, 0) / subscriptionTimes.length;

                        const averageReceivedMessageCount =
                            receivedMessageCounts.reduce((a, b) => a + b, 0) / receivedMessageCounts.length;

                        const averageRelayedMessageCount =
                            relayedMessageCounts.reduce((a, b) => a + b, 0) / relayedMessageCounts.length;

                        const averageReceivedByteCount =
                            receivedByteCounts.reduce((a, b) => a + b, 0) / receivedByteCounts.length;

                        const averageRelayedByteCount =
                            relayedByteCounts.reduce((a, b) => a + b, 0) / relayedByteCounts.length;

                        const medianReceivedMessageCount = receivedMessageCounts.sort((a, b) => a - b)[
                            Math.floor(receivedMessageCounts.length / 2)
                        ];

                        const medianRelayedMessageCount = relayedMessageCounts.sort((a, b) => a - b)[
                            Math.floor(relayedMessageCounts.length / 2)
                        ];
                        const medianReceivedByteCount = receivedByteCounts.sort((a, b) => a - b)[
                            Math.floor(receivedByteCounts.length / 2)
                        ];

                        const medianRelayedByteCount = relayedByteCounts.sort((a, b) => a - b)[
                            Math.floor(relayedByteCounts.length / 2)
                        ];

                        const medianSubscriptionTime = subscriptionTimes.sort((a, b) => a - b)[
                            Math.floor(subscriptionTimes.length / 2)
                        ];

                        return [
                            room.hashedRoomID,
                            {
                                roomType: room.roomType,
                                active_for_s: (room.lastActivityTimestamp - room.firstActivityTimestamp) / 1_000,

                                average_messages_sent_per_client: averageReceivedMessageCount,
                                average_messages_received_per_client: averageRelayedMessageCount,
                                average_data_uploaded_per_client: averageReceivedByteCount,
                                average_data_downloaded_per_client: averageRelayedByteCount,
                                average_subscription_time_per_client_s: averageSubscriptionTime,

                                median_messages_sent_per_client: medianReceivedMessageCount,
                                median_messages_received_per_client: medianRelayedMessageCount,
                                median_data_uploaded_per_client: medianReceivedByteCount,
                                median_data_downloaded_per_client: medianRelayedByteCount,
                                median_subscription_time_per_client_s: medianSubscriptionTime,
                            },
                        ];
                    }),
                ),
                clientHostnames: Array.from(clientHostnames),
                serverHostnames: Array.from(serverHostnames),
            };

            await fetch(TELEMETRY_URL, {
                method: 'POST',
                body: JSON.stringify(telemetryPayload),
            });

            await new Promise((resolve) => setTimeout(resolve, 3600_000));
        } catch {
            await new Promise((resolve) => setTimeout(resolve, 10_000));
        }
    }
}
