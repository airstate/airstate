import { TTelemetryTracker } from '../types/telemetry.mjs';
import { TMetricsTracker } from '../types/metrics.mjs';

export type TEphemeralState = {
    // telemetryTracker: TTelemetryTracker;
    metricTracker: TMetricsTracker;
};

export async function createEphemeralState(): Promise<TEphemeralState> {
    return {
        // telemetryTracker: {
        //     clients: {},
        //     rooms: {},
        // },
        metricTracker: {
            services: {
                ydoc: {
                    documents: {},
                },
                presence: {
                    rooms: {},
                },
            },
        },
    };
}

export type TEphemeralStateService = {
    ephemeralState: Awaited<ReturnType<typeof createEphemeralState>>;
};
