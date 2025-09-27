import { TMetricsTracker } from '../../types/metrics.mjs';

export function resetMetrics(metrics: TMetricsTracker) {
    const services = metrics.services;

    for (const doc of Object.values(services.ydoc.documents)) {
        for (const client of Object.values(doc.clients)) {
            client.totalUpdatesReceivedFromClients = 0;
            client.totalBytesReceivedFromClients = 0;
            client.totalUpdatesSentToClients = 0;
            client.totalBytesSentToClients = 0;
        }
    }

    for (const room of Object.values(services.presence.rooms)) {
        for (const client of Object.values(room.clients)) {
            client.totalUpdatesReceivedFromClients = 0;
            client.totalBytesReceivedFromClients = 0;
            client.totalUpdatesSentToClients = 0;
            client.totalBytesSentToClients = 0;
        }
    }
}
