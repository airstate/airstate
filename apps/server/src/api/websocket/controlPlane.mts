import { applyWSSHandler } from '@trpc/server/adapters/ws';
import { controlPlaneAppRouter, type TControlPlaneAppRouter } from '../trpc/control/routers/index.mjs';
import { type WebSocketServer } from 'ws';
import { TControlPlaneContextCreator } from '../trpc/control/context.mjs';

export async function registerControlPlaneWebSocketHandler(
    websocketServer: WebSocketServer,
    createContext: TControlPlaneContextCreator,
) {
    applyWSSHandler<TControlPlaneAppRouter>({
        wss: websocketServer,
        router: controlPlaneAppRouter,
        createContext: createContext,
        keepAlive: {
            enabled: true,
            pingMs: 5_000,
            pongWaitMs: 2_500,
        },
    });
}
