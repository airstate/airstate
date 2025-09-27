import { Express, json } from 'express';
import { TServices } from '../../services.mjs';
import { logger } from '../../logger.mjs';

export async function registerAPIPlaneHTTPRoutes(expressApp: Express, services: TServices) {
    const app = expressApp;

    app.get('/', (req, res) => {
        res.json({
            message: 'HELLO FROM AirState api-plane SERVER',
        });
    });

    app.put('/:namespace/server-state/:stateKey', json({}), async (req, res) => {
        // replace the entire state

        const subscriptionKey = `${req.params.namespace}:${req.params.stateKey}`;

        const dataKey = `server-state:data:${subscriptionKey}`;
        const channelKey = `server-state:update:${subscriptionKey}`;

        const data = JSON.stringify(req.body);

        logger.debug(`setting data to ${dataKey}`);
        await services.valkey.set(dataKey, data);

        logger.debug(`publishing event to ${channelKey}`);
        await services.valkey.publish(channelKey, data);

        return res.json(req.body);
    });
}
