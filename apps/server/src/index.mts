import { createServices } from './services.mjs';
import { initServicePlane } from './init/servicePlane.mjs';

const services = await createServices();

await initServicePlane(services);

export { TServicePlaneAppRouter } from './api/trpc/service/routers/index.mjs';
