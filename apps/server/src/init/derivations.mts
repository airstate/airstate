import { env } from '../env.mjs';

export const controlPlanePort = parseInt(env.AIRSTATE_CONTROL_PORT ?? env.CONTROL_PORT ?? '21001');
