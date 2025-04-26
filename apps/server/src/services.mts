import { createNATSConnection, createStringCodec } from './services/nats/nats.mjs';
import { env } from './env.mjs';
import { createJetStreamClient, createJetStreamManager } from './services/nats/jetstream.mjs';
import { createSharedStateKV } from './services/nats/kv.mjs';
import { NATSServices } from './types/nats.mjs';

export async function createServices(): Promise<NATSServices> {
    const natsStringCodec = createStringCodec();
    const natsConnection = await createNATSConnection(env.NATS_URLS.split(',').map((url) => url.trim()));

    const jetStreamClient = createJetStreamClient(natsConnection);
    const jetStreamManager = await createJetStreamManager(natsConnection);

    const sharedStateKV = await createSharedStateKV(natsConnection);

    return {
        natsStringCodec,
        natsConnection,
        jetStreamClient,
        jetStreamManager,
        sharedStateKV,
    };
}

export type TServices = Awaited<ReturnType<typeof createServices>>;
