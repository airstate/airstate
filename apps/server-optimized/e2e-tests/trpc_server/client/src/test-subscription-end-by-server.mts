import { closeClient, trpcClient } from './common/client.mjs';
import logger from './common/logger.mjs';

let stopped = false;

const subscription = trpcClient.seconds.subscribe(undefined, {
    onStarted() {
        logger.debug('subscription started; waiting for 8s for auto-stop');

        setTimeout(() => {
            setTimeout(async () => {
                await closeClient();
            }, 100);

            if (!stopped) {
                console.log(
                    JSON.stringify({
                        passed: false,
                        error: 'expected subscription to stop after 7s',
                    }),
                );

                subscription.unsubscribe();
                return;
            }

            console.log(JSON.stringify({ passed: true }));
        }, 8_100);
    },
    onData(value) {},
    onStopped() {
        stopped = true;
    },
});
