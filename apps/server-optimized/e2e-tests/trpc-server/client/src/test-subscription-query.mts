import { closeClient, trpcClient } from './common/client.mjs';
import logger from './common/logger.mjs';

const data: { unix: number }[] = [];

const subscription = trpcClient.seconds.subscribe(undefined, {
    onStarted() {
        logger.debug('subscription started, waiting for 5s before unsubscribing');

        setTimeout(() => {
            logger.debug('unsubscribing');
            subscription.unsubscribe();

            setTimeout(async () => {
                logger.debug('closing client');
                await closeClient();
            }, 100);

            if (data.length !== 5) {
                console.log(JSON.stringify({ passed: false, error: `expected 5 data points, got ${data.length}` }));
                return;
            }

            try {
                let cumDiff = 0;

                for (let i = 0; i < data.length - 1; i += 1) {
                    cumDiff += data[i + 1].unix - data[i].unix;
                }

                if (cumDiff !== 4) {
                    console.log(
                        JSON.stringify({
                            passed: false,
                            error: `expected each data point to be one second apart; got cumulative difference ${cumDiff}`,
                        }),
                    );

                    return;
                }
            } catch (e) {
                console.log(JSON.stringify({ passed: false, error: `${e}` }));
                return;
            }

            console.log(JSON.stringify({ passed: true }));
        }, 5_100);
    },
    onData(value) {
        logger.debug('subscription data', value);
        data.push(value);
    },
    onStopped() {},
});
