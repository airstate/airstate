import { TTelemetryTracker } from '../types/telemetry.mjs';

export type TEphemeralState = {
    telemetryTracker: TTelemetryTracker;
};

export async function createEphemeralState(): Promise<TEphemeralState> {
    return {
        telemetryTracker: {
            clients: {},
            rooms: {},
        },
    };
}

export type TEphemeralStateService = {
    ephemeralState: Awaited<ReturnType<typeof createEphemeralState>>;
};
