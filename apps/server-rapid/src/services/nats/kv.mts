import { NatsConnection, StorageType } from 'nats';

export async function createMainKV(natsConnection: NatsConnection) {
    return await natsConnection.jetstream().views.kv('airstate-main', { storage: StorageType.File });
}
