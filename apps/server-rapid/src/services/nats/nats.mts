import { connect, StringCodec } from 'nats';

export function createStringCodec() {
    return StringCodec();
}

export async function createNATSConnection(servers: string[]) {
    return await connect({
        servers: servers,
    });
}
