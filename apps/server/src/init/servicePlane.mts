import express from 'express';
import { createServer } from 'node:http';
import { WebSocketServer } from 'ws';
import cookie from 'cookie';
import { nanoid } from 'nanoid';
import { servicePlaneHTTPContextCreatorFactory } from '../api/trpc/service/context.mjs';
import { logger } from '../logger.mjs';
import { registerServicePlaneHTTPRoutes } from '../api/http/servicePlane.mjs';
import { registerServicePlaneWebSocketHandler } from '../api/websocket/servicePlane.mjs';
import { env } from '../env.mjs';
import { TServices } from '../services.mjs';

export async function initServicePlane(services: TServices) {
    const servicePlaneExpressApp = express();

    // separate HTTP server instance to share
    // server instance between express and ws server
    const servicePlaneServer = createServer(servicePlaneExpressApp);

    const servicePlaneWebSocketServer = new WebSocketServer({
        noServer: true,
        path: '/ws',
    });

    servicePlaneServer.on('upgrade', async (request, socket, head) => {
        if (servicePlaneWebSocketServer.shouldHandle(request)) {
            const cookies = cookie.parse(request.headers.cookie ?? '');

            const clientIdentifier =
                'airstate_client_identifier' in cookies && cookies.airstate_client_identifier
                    ? cookies.airstate_client_identifier
                    : nanoid();

            servicePlaneWebSocketServer.once('headers', (headers, request) => {
                if (!('airstate_client_identifier' in cookies) || !cookies.airstate_client_identifier) {
                    headers.push(
                        `Set-Cookie: airstate_client_identifier=${clientIdentifier}; Path=/; Domain=; HttpOnly; SameSite=None; Secure; Partitioned;`,
                    );
                }
            });

            servicePlaneWebSocketServer.handleUpgrade(request, socket, head, (ws) => {
                servicePlaneWebSocketServer.emit('connection', ws, request);
            });
        } else {
            socket.end();
        }
    });

    const createServicePlaneHTTPContext = await servicePlaneHTTPContextCreatorFactory(services);

    logger.debug('registering service-plane http routes');
    await registerServicePlaneHTTPRoutes(servicePlaneExpressApp, createServicePlaneHTTPContext, services);

    logger.debug('attaching service-plane ws handlers');
    await registerServicePlaneWebSocketHandler(servicePlaneWebSocketServer, createServicePlaneHTTPContext);

    const servicePlanePort = parseInt(env.AIRSTATE_PORT ?? env.PORT ?? '11001');

    servicePlaneServer.listen(servicePlanePort, '0.0.0.0', () => {
        logger.info(`🚂 express: service-plane: listening on http://0.0.0.0:${servicePlanePort}/`, {
            port: servicePlanePort,
        });
    });
}
