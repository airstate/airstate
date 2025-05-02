import { createNATSConnection, createStringCodec } from './services/nats/nats.mjs';
import { env } from './env.mjs';
import { createJetStreamClient, createJetStreamManager } from './services/nats/jetstream.mjs';
import { createSharedStateKV } from './services/nats/kv.mjs';
import { NATSServices } from './types/nats.mjs';
import { createValkeyConnection, TValkeyService } from './db/valkey/index.mjs';
import { createInfoService, TInfoService } from './services/info.mjs';
import { createControlClients, TControlClientsService } from './services/controlClients.mjs';

export async function createServices(): Promise<NATSServices & TValkeyService & TInfoService & TControlClientsService> {
    const natsStringCodec = createStringCodec();
    const natsConnection = await createNATSConnection(env.AIRSTATE_NATS_URLS.split(',').map((url) => url.trim()));

    const jetStreamClient = createJetStreamClient(natsConnection);
    const jetStreamManager = await createJetStreamManager(natsConnection);

    const sharedStateKV = await createSharedStateKV(natsConnection);

    const valkey = await createValkeyConnection({ connect: true });
    const info = await createInfoService();
    const controlClients = await createControlClients();

    return {
        natsStringCodec,
        natsConnection,
        jetStreamClient,
        jetStreamManager,
        sharedStateKV,
        valkey,
        info,
        controlClients,
    };
}

export type TServices = Awaited<ReturnType<typeof createServices>>;
