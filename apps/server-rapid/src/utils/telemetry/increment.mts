// export function incrementTelemetryTrackers(
//     applyTo: {
//         lastActivityTimestamp: number;
//
//         totalMessagesReceived: number;
//         totalMessagesRelayed: number;
//
//         totalBytesReceived: number;
//         totalBytesRelayed: number;
//     }[],
//     bytes: number,
//     direction: 'received' | 'relayed',
// ) {
//     applyTo.forEach((item) => {
//         item.lastActivityTimestamp = Date.now();
//
//         if (direction === 'received') {
//             item.totalMessagesReceived += 1;
//             item.totalBytesReceived += bytes;
//         } else {
//             item.totalMessagesRelayed += 1;
//             item.totalBytesRelayed += bytes;
//         }
//     });
// }
