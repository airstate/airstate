import { closeClient, trpcClient } from './common/client.mjs';
import logger from './common/logger.mjs';
import { z } from 'zod';

logger.debug('sending `_` query');
const response = await trpcClient._.query();

logger.debug('received response, parsing for integrity');
const parseResult = z
    .object({
        message: z.string(),
        time: z.iso.datetime(),
    })
    .safeParse(response);

if (parseResult.success) {
    console.log(JSON.stringify({ passed: true }));
} else {
    console.log(JSON.stringify({ passed: false, error: parseResult.error }));
}

logger.debug('closing client');
await closeClient();
