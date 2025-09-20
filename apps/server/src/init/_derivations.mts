import { env } from '../env.mjs';

export const servicePlanePort = parseInt(env.AIRSTATE_PORT ?? env.PORT ?? '11001');
export const controlPlanePort = parseInt(env.AIRSTATE_CONTROL_PORT ?? env.CONTROL_PORT ?? '21001');
export const apiPlanePort = parseInt(env.AIRSTATE_API_PORT ?? env.API_PORT ?? '31001');
