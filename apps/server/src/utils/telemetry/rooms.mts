import { createHash } from 'node:crypto';
import { TTelemetryTracker } from '../../types/telemetry.mjs';

export function initTelemetryTrackerRoom(telemetryTracker: TTelemetryTracker, roomKey: string) {
    const telemetryTrackerRooms = telemetryTracker.rooms;
    const telemetryTrackerRoomID = `yjs_${roomKey}`;

    if (!(telemetryTrackerRoomID in telemetryTrackerRooms)) {
        const hashedTelemetryTrackerRoomID = createHash('sha256').update(telemetryTrackerRoomID).digest('hex');

        telemetryTrackerRooms[telemetryTrackerRoomID] = {
            roomID: telemetryTrackerRoomID,
            hashedRoomID: hashedTelemetryTrackerRoomID,
            roomType: 'ydoc',

            firstActivityTimestamp: Date.now(),
            lastActivityTimestamp: Date.now(),

            totalMessagesReceived: 0,
            totalMessagesRelayed: 0,
            totalBytesReceived: 0,
            totalBytesRelayed: 0,

            clients: {},
        };
    }

    return telemetryTrackerRooms[telemetryTrackerRoomID];
}
