import { TInfoService } from '../services/info.mjs';
// import { TTelemetryClient, TTelemetryPayload, TTelemetryRoom, TTelemetryTracker } from '../types/telemetry.mjs';
import { VERSION } from '../version.mjs';

export const TELEMETRY_URL = process.env.TELEMETRY_URL ?? 'https://telemetry.airstate.dev/ingest';

// export async function runTelemetryDaemon(telemetryTracker: TTelemetryTracker, services: TInfoService) {
//     const { info } = services;
//
//     let runTelemetry = false;
//
//     try {
//         const req = await fetch(TELEMETRY_URL, {
//             method: 'GET',
//         });
//
//         if (req.status === 200) {
//             runTelemetry = true;
//         }
//     } catch {
//         runTelemetry = false;
//     }
//
//     while (runTelemetry && !('DISABLE_TELEMETRY' in process.env)) {}
// }
