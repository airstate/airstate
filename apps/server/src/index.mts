import { createServer } from 'node:http';
import express from 'express';
import { createServices } from './services.mjs';
import { httpContextCreatorFactory } from './api/trpc/context.mjs';
import { registerHTTPRoutes } from './api/http/index.mjs';
import { WebSocketServer } from 'ws';
import { logger } from './logger.mjs';
import { env } from './env.mjs';
import { registerWSHandlers } from './api/websocket/index.mjs';

const services = await createServices();
const expressApp = express();

// separate HTTP server instance to share
// server instance between express and ws server
const server = createServer(expressApp);

const wsServer = new WebSocketServer({
    server: server,
    path: '/ws',
});

const createHTTPContext = await httpContextCreatorFactory(services);

logger.debug('registering http routes');
await registerHTTPRoutes(expressApp, createHTTPContext);

logger.debug('attaching ws handlers');
await registerWSHandlers(wsServer, createHTTPContext);

const port = parseInt(env.AIRSTATE_PORT ?? env.PORT ?? '11001');

server.listen(port, '0.0.0.0', () => {
    logger.info(`🚂 express: listening on http://0.0.0.0:${port}/`, {
        port: port,
    });
});

export { TAppRouter } from './api/trpc/routers/index.mjs';
