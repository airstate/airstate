import { Redis } from 'iovalkey';
import { TEphemeralState } from '../services/ephemeralState.mjs';
import { logger } from '../logger.mjs';

export function handleServerStateUpdates(valkey: Redis, ephemeralState: TEphemeralState) {
    let i = 0;

    valkey.on('message', (channelKey, message) => {
        const id = i++;

        logger.debug(`message received on channel ${channelKey}`, {
            id: id,
            channelKey: channelKey,
            channelMessage: message,
        });

        const data = JSON.parse(message);

        const channels = ephemeralState.service.serverState.channels;

        if (!(channelKey in channels)) {
            return;
        }

        const channel = channels[channelKey];

        logger.debug(`subscriptions found for channel, emitting to listeners`, {
            id: id,
            listenerCount: channel.subscriptionListeners.size,
            stateKey: channel.stateKey,
            channelKey: channelKey,
            channelData: data,
        });

        channel.subscriptionListeners.forEach((listener) => {
            listener(channel.stateKey, data);
        });
    });
}
