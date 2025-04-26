import express, { Request, type Express } from 'express';
import * as trpcExpress from '@trpc/server/adapters/express';
import { TContextCreator } from '../trpc/context.mjs';
import { appRouter } from '../trpc/routers/index.mjs';
import { errorMiddleware } from './middleware/errorMiddleware.mjs';

export async function registerHTTPRoutes(expressApp: Express, createContext: TContextCreator) {
    const app = expressApp;

    app.get('/', (req, res) => {
        res.json({
            message: "HELLO FROM AirState's SERVER",
        });
    });

    app.use(
        '/trpc',
        trpcExpress.createExpressMiddleware({
            router: appRouter,
            createContext,
        }),
    );

    // Register HTTP endpoints
    const httpEndpointRouter = express.Router();
    app.use('/http', httpEndpointRouter);

    app.use(errorMiddleware);
}
