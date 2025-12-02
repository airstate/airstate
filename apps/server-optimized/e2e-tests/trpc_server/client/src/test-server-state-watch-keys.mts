import { closeClient, trpcClient } from './common/client.mjs';
import logger from './common/logger.mjs';

type TServerStateMessage =
    | {
          type: 'session-info';
          session_id: string;
      }
    | {
          type: 'init';
      }
    | {
          type: 'updates';
          updates: Array<{
              key: string;
              value: any;
          }>;
      };

const APP_ID = '_default';
const TEST_KEY = 'e2e-trpc-server-state-key';

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
    return new Promise<T>((resolve, reject) => {
        const timer = setTimeout(() => {
            reject(new Error(`timeout (${ms}ms) while waiting for ${label}`));
        }, ms);

        promise
            .then((value) => {
                clearTimeout(timer);
                resolve(value);
            })
            .catch((err) => {
                clearTimeout(timer);
                reject(err);
            });
    });
}

async function replaceServerStateValue(appId: string, key: string, value: any) {
    const url = `http://localhost:11002/${encodeURIComponent(appId)}/server-state/${encodeURIComponent(key)}`;

    // Rely on built-in fetch from Node 18+ / 20+
    const response = await fetch(url, {
        method: 'PUT',
        headers: {
            'content-type': 'application/json',
        },
        body: JSON.stringify({ value }),
    });

    if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error(`failed to replace server-state value: ${response.status} ${response.statusText} ${text}`);
    }
}

const receivedUpdates: Array<{ key: string; value: any }> = [];
let newValueMarker: string | null = null;

let resolveSessionId: ((id: string) => void) | null = null;
const sessionIdPromise = new Promise<string>((resolve) => {
    resolveSessionId = resolve;
});

const subscription = trpcClient.serverState.serverState.subscribe(
    {},
    {
        onStarted() {
            logger.debug('server-state subscription started');
        },
        onData(message: TServerStateMessage) {
            logger.debug('server-state message', message);

            if (message.type === 'session-info') {
                if (resolveSessionId) {
                    resolveSessionId(message.session_id);
                    resolveSessionId = null;
                }
            } else if (message.type === 'updates') {
                for (const update of message.updates) {
                    receivedUpdates.push(update);
                }
            }
        },
        onStopped() {
            logger.debug('server-state subscription stopped');
        },
    },
);

(async () => {
    try {
        const sessionId = await withTimeout(sessionIdPromise, 5_000, 'server-state session id');
        logger.debug(`obtained server-state session id: ${sessionId}`);

        const watchResult = await withTimeout(
            trpcClient.serverState.watchKeys.mutate({
                appId: APP_ID,
                sessionId,
                keys: [TEST_KEY],
            }),
            5_000,
            'server-state watchKeys mutation',
        );

        logger.debug('watchKeys mutation result', watchResult);

        newValueMarker = `e2e-${Date.now()}`;
        const newValue = { now: Date.now(), flag: true, marker: newValueMarker };
        await withTimeout(replaceServerStateValue(APP_ID, TEST_KEY, newValue), 5_000, 'server-state value replace');

        const deadline = Date.now() + 10_000;
        while (Date.now() < deadline) {
            const match = receivedUpdates.find(
                (u) =>
                    u.key === TEST_KEY &&
                    u.value &&
                    u.value.flag === true &&
                    typeof u.value.marker === 'string' &&
                    newValueMarker !== null &&
                    u.value.marker === newValueMarker,
            );

            if (match) {
                break;
            }

            await new Promise((r) => setTimeout(r, 50));
        }

        const matchingUpdates = receivedUpdates.filter((u) => u.key === TEST_KEY);

        if (matchingUpdates.length === 0) {
            return;
        }
    } catch (e) {
    } finally {
        try {
            subscription.unsubscribe();
        } catch {}

        try {
            await closeClient();
        } catch {}
    }
})();
