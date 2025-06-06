import { createNATSConnection, createStringCodec } from './services/nats/nats.mjs';
import { env } from './env.mjs';
import { createJetStreamClient, createJetStreamManager } from './services/nats/jetstream.mjs';
import { createMainKV } from './services/nats/kv.mjs';
import { NATSServices } from './types/nats.mjs';
import { createValkeyConnection, TValkeyService } from './db/valkey/index.mjs';
import { createInfoService, TInfoService } from './services/info.mjs';
import { createControlClients, TControlClientsService } from './services/controlClients.mjs';
import { createLocalState, TLocalStateService } from './services/localState.mjs';

export async function createServices(): Promise<
    NATSServices & TValkeyService & TInfoService & TControlClientsService & TLocalStateService
> {
    const natsStringCodec = createStringCodec();
    const natsConnection = await createNATSConnection(env.AIRSTATE_NATS_URLS.split(',').map((url) => url.trim()));

    const jetStreamClient = createJetStreamClient(natsConnection);
    const jetStreamManager = await createJetStreamManager(natsConnection);

    const mainKV = await createMainKV(natsConnection);

    const valkey = await createValkeyConnection({ connect: true });
    const controlClients = await createControlClients();

    const localState = await createLocalState();

    const info = await createInfoService({
        mainKV: mainKV,
    });

    return {
        natsStringCodec: natsStringCodec,
        natsConnection: natsConnection,
        jetStreamClient: jetStreamClient,
        jetStreamManager: jetStreamManager,
        mainKV: mainKV,
        valkey: valkey,
        info: info,
        controlClients: controlClients,
        localState: localState,
    };
}

export type TServices = Awaited<ReturnType<typeof createServices>>;
