import { Redis } from 'iovalkey';
import { env } from '../../env.mjs';

export async function createValkeyConnection(options?: { url?: string; connect?: boolean }) {
    const valkey = new Redis(options?.url ?? env.VALKEY_CONNECTION_URL, {
        lazyConnect: true,
    });

    if (options?.connect) {
        await valkey.connect();
    }

    return valkey;
}

export type TValkeyService = {
    valkey: Redis;
};
