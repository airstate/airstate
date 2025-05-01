import { applyWSSHandler } from '@trpc/server/adapters/ws';
import { servicePlaneAppRouter, TServicePlaneAppRouter } from '../trpc/service/routers/index.mjs';
import { type WebSocketServer } from 'ws';
import { TContextCreator } from '../trpc/service/context.mjs';

export async function registerServicePlaneWebSocketHandler(
    websocketServer: WebSocketServer,
    createContext: TContextCreator,
) {
    applyWSSHandler<TServicePlaneAppRouter>({
        wss: websocketServer,
        router: servicePlaneAppRouter,
        createContext: createContext,
        keepAlive: {
            enabled: true,
            pingMs: 5_000,
            pongWaitMs: 2_500,
        },
    });
}
