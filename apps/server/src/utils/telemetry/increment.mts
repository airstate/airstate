export function incrementTelemetryTrackers(
    applyTo: {
        lastActivityTimestamp: number;

        totalMessagesReceived: number;
        totalMessagesRelayed: number;

        totalBytesReceived: number;
        totalBytesRelayed: number;
    }[],
    bytes: number,
) {
    applyTo.forEach((item) => {
        item.lastActivityTimestamp = Date.now();

        item.totalMessagesReceived += 1;
        item.totalBytesReceived += bytes;
    });
}
