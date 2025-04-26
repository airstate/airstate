import { applyWSSHandler } from '@trpc/server/adapters/ws';
import { appRouter, TAppRouter } from '../trpc/routers/index.mjs';
import { type WebSocketServer } from 'ws';
import { TContextCreator } from '../trpc/context.mjs';

export async function registerWSHandlers(websocketServer: WebSocketServer, createContext: TContextCreator) {
    applyWSSHandler<TAppRouter>({
        wss: websocketServer,
        router: appRouter,
        createContext: createContext,
        keepAlive: {
            enabled: true,
            pingMs: 5_000,
            pongWaitMs: 2_500,
        },
    });
}
