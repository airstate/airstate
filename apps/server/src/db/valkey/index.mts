import { Redis } from 'iovalkey';
import { env } from '../../env.mjs';

export async function createValkeyConnection(options?: { url?: string; connect?: boolean }) {
    console.log('valkey url', process.env.VALKEY_URL!!);
    const valkey = new Redis(options?.url ?? process.env.VALKEY_URL!! + '?family=0', {
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
