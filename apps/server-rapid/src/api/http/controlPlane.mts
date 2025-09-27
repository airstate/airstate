import express, { Request, type Express } from 'express';
import * as trpcExpress from '@trpc/server/adapters/express';
import { errorMiddleware } from './middleware/errorMiddleware.mjs';
import { TControlPlaneContextCreator } from '../trpc/control/context.mjs';
import { controlPlaneAppRouter } from '../trpc/control/routers/index.mjs';
import { registerAPIPlaneHTTPRoutes } from './apiPlane.mjs';
import { TServices } from '../../services.mjs';

export async function registerControlPlaneHTTPRoutes(
    expressApp: Express,
    services: TServices,
    createContext: TControlPlaneContextCreator,
) {
    const app = expressApp;

    app.get('/', (req, res) => {
        res.json({
            message: 'HELLO FROM AirState control-plane SERVER',
        });
    });

    app.use(
        '/trpc',
        trpcExpress.createExpressMiddleware({
            router: controlPlaneAppRouter,
            createContext,
        }),
    );

    // Register HTTP endpoints
    registerAPIPlaneHTTPRoutes(app, services);

    const httpEndpointRouter = express.Router();
    app.use('/http', httpEndpointRouter);

    app.use(errorMiddleware);
}
