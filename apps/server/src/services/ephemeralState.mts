import { TTelemetryTracker } from '../types/telemetry.mjs';

export type TEphemeralState = {
    telemetryTracker: TTelemetryTracker;
};

export async function createEphemeralState() {
    return {
        telemetryTracker: {
            clients: {},
            rooms: {},
        },
    } satisfies TEphemeralState;
}

export type TEphemeralStateService = {
    ephemeralState: Awaited<ReturnType<typeof createEphemeralState>>;
};
