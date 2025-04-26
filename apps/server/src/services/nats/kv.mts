import { NatsConnection, StorageType } from 'nats';

export async function createSharedStateKV(natsConnection: NatsConnection) {
    return await natsConnection.jetstream().views.kv('shared-state', { storage: StorageType.File });
}
