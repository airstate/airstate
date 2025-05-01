import express, { Request, type Express } from 'express';
import * as trpcExpress from '@trpc/server/adapters/express';
import { errorMiddleware } from './middleware/errorMiddleware.mjs';
import { TControlPlaneContextCreator } from '../trpc/control/context.mjs';
import { controlPlaneAppRouter } from '../trpc/control/routers/index.mjs';

export async function registerControlPlaneHTTPRoutes(expressApp: Express, createContext: TControlPlaneContextCreator) {
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
    const httpEndpointRouter = express.Router();
    app.use('/http', httpEndpointRouter);

    app.use(errorMiddleware);
}
