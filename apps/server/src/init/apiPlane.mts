import express from 'express';
import { createServer } from 'node:http';
import { WebSocketServer } from 'ws';
import { logger } from '../logger.mjs';
import { TServices } from '../services.mjs';
import { apiPlanePort } from './_derivations.mjs';
import { registerAPIPlaneHTTPRoutes } from '../api/http/apiPlane.mjs';

export async function initAPIPlane(services: TServices) {
    const apiPlaneExpressApp = express();

    // separate HTTP server instance to share
    // server instance between express and ws server
    const apiPlaneHTTPServer = createServer(apiPlaneExpressApp);

    const apiPlaneWebSocketServer = new WebSocketServer({
        noServer: true,
        path: '/ws',
    });

    apiPlaneHTTPServer.on('upgrade', async (request, socket, head) => {
        if (apiPlaneWebSocketServer.shouldHandle(request)) {
            apiPlaneWebSocketServer.handleUpgrade(request, socket, head, (ws) => {
                apiPlaneWebSocketServer.emit('connection', ws, request);
            });
        } else {
            socket.end();
        }
    });

    logger.debug('registering api-plane http routes');
    await registerAPIPlaneHTTPRoutes(apiPlaneExpressApp, services);

    apiPlaneHTTPServer.listen(apiPlanePort, '0.0.0.0', () => {
        logger.info(`🚂 express: api-plane: listening on http://0.0.0.0:${apiPlanePort}/`, {
            port: apiPlanePort,
        });
    });
}
