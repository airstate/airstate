export function incrementMetricsTracker(
    applyTo: {
        totalUpdatesReceivedFromClients: number;
        totalBytesReceivedFromClients: number;

        totalUpdatesSentToClients: number;
        totalBytesSentToClients: number;
    },
    bytes: number,
    direction: 'received' | 'sent',
) {
    if (direction === 'received') {
        applyTo.totalUpdatesReceivedFromClients += 1;
        applyTo.totalBytesReceivedFromClients += bytes;
    } else {
        applyTo.totalUpdatesSentToClients += 1;
        applyTo.totalBytesSentToClients += bytes;
    }
}
