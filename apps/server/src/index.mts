import { createServices } from './services.mjs';
import { initServicePlane } from './init/servicePlane.mjs';
import { initControlPlane } from './init/controlPlane.mjs';
import { runTelemetryDaemon } from './daemons/telemetry.mjs';

const services = await createServices();

await Promise.all([initServicePlane(services), initControlPlane(services)]);

export { TServicePlaneAppRouter } from './api/trpc/service/routers/index.mjs';
export { TControlPlaneAppRouter } from './api/trpc/control/routers/index.mjs';
export { TPresenceState } from './api/trpc/service/procedures/presence/_helpers.mjs';

runTelemetryDaemon(services.ephemeralState.telemetryTracker, services);
