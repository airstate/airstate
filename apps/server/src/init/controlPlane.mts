import express from 'express';
import { createServer } from 'node:http';
import { WebSocketServer } from 'ws';
import { logger } from '../logger.mjs';
import { env } from '../env.mjs';
import { TServices } from '../services.mjs';
import { controlPlaneHTTPContextCreatorFactory } from '../api/trpc/control/context.mjs';
import { registerControlPlaneHTTPRoutes } from '../api/http/controlPlane.mjs';
import { registerControlPlaneWebSocketHandler } from '../api/websocket/controlPlane.mjs';
import { controlPlanePort } from './derivations.mjs';

export async function initControlPlane(services: TServices) {
    const controlPlaneExpressApp = express();

    // separate HTTP server instance to share
    // server instance between express and ws server
    const controlPlaneServer = createServer(controlPlaneExpressApp);

    const controlPlaneWebSocketServer = new WebSocketServer({
        noServer: true,
        path: '/ws',
    });

    controlPlaneServer.on('upgrade', async (request, socket, head) => {
        if (controlPlaneWebSocketServer.shouldHandle(request)) {
            controlPlaneWebSocketServer.handleUpgrade(request, socket, head, (ws) => {
                controlPlaneWebSocketServer.emit('connection', ws, request);
            });
        } else {
            socket.end();
        }
    });

    const createControlPlaneHTTPContext = await controlPlaneHTTPContextCreatorFactory(services);

    logger.debug('registering control-plane http routes');
    await registerControlPlaneHTTPRoutes(controlPlaneExpressApp, createControlPlaneHTTPContext);

    logger.debug('attaching control-plane ws handlers');
    await registerControlPlaneWebSocketHandler(controlPlaneWebSocketServer, createControlPlaneHTTPContext);

    controlPlaneServer.listen(controlPlanePort, '0.0.0.0', () => {
        logger.info(`🚂 express: control-plane: listening on http://0.0.0.0:${controlPlanePort}/`, {
            port: controlPlanePort,
        });
    });
}
