import { createNATSConnection, createStringCodec } from './services/nats/nats.mjs';
import { env } from './env.mjs';
import { createJetStreamClient, createJetStreamManager } from './services/nats/jetstream.mjs';
import { createSharedStateKV } from './services/nats/kv.mjs';
import { NATSServices } from './types/nats.mjs';
import { createValkeyConnection, TValkeyService } from './db/valkey/index.mjs';

export async function createServices(): Promise<NATSServices & TValkeyService> {
    const natsStringCodec = createStringCodec();
    const natsConnection = await createNATSConnection(env.AIRSTATE_NATS_URLS.split(',').map((url) => url.trim()));

    const jetStreamClient = createJetStreamClient(natsConnection);
    const jetStreamManager = await createJetStreamManager(natsConnection);

    const sharedStateKV = await createSharedStateKV(natsConnection);

    const valkey = await createValkeyConnection({ connect: true });

    return {
        natsStringCodec,
        natsConnection,
        jetStreamClient,
        jetStreamManager,
        sharedStateKV,
        valkey,
    };
}

export type TServices = Awaited<ReturnType<typeof createServices>>;
