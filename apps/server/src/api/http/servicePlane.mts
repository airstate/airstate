import express, { Request, type Express } from 'express';
import * as trpcExpress from '@trpc/server/adapters/express';
import { TContextCreator } from '../trpc/service/context.mjs';
import { servicePlaneAppRouter } from '../trpc/service/routers/index.mjs';
import { errorMiddleware } from './middleware/errorMiddleware.mjs';

export async function registerServicePlaneHTTPRoutes(expressApp: Express, createContext: TContextCreator) {
    const app = expressApp;

    app.get('/', (req, res) => {
        res.json({
            message: 'HELLO FROM AirState service-plane SERVER',
        });
    });

    app.use(
        '/trpc',
        trpcExpress.createExpressMiddleware({
            router: servicePlaneAppRouter,
            createContext,
        }),
    );

    // Register HTTP endpoints
    const httpEndpointRouter = express.Router();
    app.use('/http', httpEndpointRouter);

    app.use(errorMiddleware);
}
