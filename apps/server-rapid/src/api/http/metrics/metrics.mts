import type { Router, Response, Request } from 'express';
import { logger } from '../../../logger.mjs';
import { TServices } from '../../../services.mjs';
import { flattenMetricsJSONL } from '../../../utils/metric/flattenMetrics.mjs';
import { resetMetrics } from '../../../utils/metric/resetMetrics.mjs';

export function registerMetricsHTTPRoutes(router: Router, services: TServices) {
    const consumeMetrics = async (req: Request, res: Response) => {
        let clientDisconnected = false;

        req.on('close', () => {
            clientDisconnected = true;
        });

        try {
            const metrics = services.ephemeralState.metricTracker;

            res.setHeader('Content-Type', 'application/x-ndjson');
            res.setHeader('Transfer-Encoding', 'chunked');

            for await (const line of flattenMetricsJSONL(metrics)) {
                if (clientDisconnected) {
                    logger.warn('client disconnected during metrics stream');
                    return;
                }

                const canContinue = res.write(line);
                if (!canContinue) {
                    await new Promise((resolve) => res.once('drain', resolve));
                }
            }

            if (!clientDisconnected) {
                resetMetrics(metrics);
                res.end();
            }
        } catch (error) {
            logger.error(error);

            if (!res.headersSent) {
                res.status(500).json({
                    message: 'there were errors while consuming metrics',
                });
            }
        }
    };
    router.post('/metrics', consumeMetrics);
}
