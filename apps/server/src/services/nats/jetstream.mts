import { NatsConnection } from 'nats';

export function createJetStreamClient(natsConnection: NatsConnection) {
    return natsConnection.jetstream();
}

export async function createJetStreamManager(natsConnection: NatsConnection) {
    return await natsConnection.jetstreamManager();
}
