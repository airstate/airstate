import { Redis } from 'iovalkey';
import { TEphemeralState } from '../services/ephemeralState.mjs';
import { logger } from '../logger.mjs';

export function handleRedisSubscriptionReconnection(valkey: Redis, ephemeralState: TEphemeralState) {
    valkey.on('ready', async () => {
        const channelKeys = Object.values(ephemeralState.service.serverState.channels).map((subscription) => {
            return subscription.subscriptionKey;
        });

        logger.debug('valkey is ready; subscribing to re-subscribing to channelKeys', {
            channelKeys: channelKeys,
        });

        await valkey.subscribe(...channelKeys);
    });
}
