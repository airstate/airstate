import { createNATSConnection, createStringCodec } from './services/nats/nats.mjs';
import { env } from './env.mjs';
import { createJetStreamClient, createJetStreamManager } from './services/nats/jetstream.mjs';
import { createMainKV } from './services/nats/kv.mjs';
import { NATSServices } from './types/nats.mjs';
import { createValkeyConnection, TValkeyService } from './db/valkey/index.mjs';
import { createInfoService, TInfoService } from './services/info.mjs';
import { createControlClients, TControlClientsService } from './services/controlClients.mjs';
import { createLocalState, TLocalStateService } from './services/localState.mjs';
import { createEphemeralState, TEphemeralStateService } from './services/ephemeralState.mjs';
import { handleRedisSubscriptionReconnection } from './handlers/redisSubscriptionInitializer.mjs';
import { handleServerStateUpdates } from './handlers/serverStateUpdates.mjs';

export async function createServices(): Promise<
    NATSServices & TValkeyService & TInfoService & TControlClientsService & TLocalStateService & TEphemeralStateService
> {
    const natsStringCodec = createStringCodec();
    const natsConnection = await createNATSConnection(
        (env.AIRSTATE_NATS_URL ?? env.NATS_URL ?? 'nats://localhost:4222').split(',').map((url) => url.trim()),
    );

    const jetStreamClient = createJetStreamClient(natsConnection);
    const jetStreamManager = await createJetStreamManager(natsConnection);

    const mainKV = await createMainKV(natsConnection);

    const valkey = await createValkeyConnection({ connect: true });
    const valkeySubscription = await createValkeyConnection({ connect: true });

    const controlClients = await createControlClients();

    const localState = await createLocalState();
    const ephemeralState = await createEphemeralState();

    const info = await createInfoService({
        mainKV: mainKV,
    });

    handleRedisSubscriptionReconnection(valkeySubscription, ephemeralState);
    handleServerStateUpdates(valkeySubscription, ephemeralState);

    return {
        natsStringCodec: natsStringCodec,
        natsConnection: natsConnection,
        jetStreamClient: jetStreamClient,
        jetStreamManager: jetStreamManager,
        mainKV: mainKV,
        valkey: valkey,
        valkeySubscription: valkeySubscription,
        info: info,
        controlClients: controlClients,
        localState: localState,
        ephemeralState: ephemeralState,
    };
}

export type TServices = Awaited<ReturnType<typeof createServices>>;
