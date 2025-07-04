import { Redis } from 'iovalkey';
import { env } from '../../env.mjs';

export async function createValkeyConnection(options?: { url?: string; connect?: boolean }) {
    const valkey = new Redis(
        options?.url ??
            env.AIRSTATE_VALKEY_URL ??
            env.AIRSTATE_REDIS_URL ??
            env.VALKEY_URL ??
            env.REDIS_URL ??
            'redis://localhost:6379',
        {
            lazyConnect: true,
        },
    );

    if (options?.connect) {
        await valkey.connect();
    }

    return valkey;
}

export type TValkeyService = {
    valkey: Redis;
};
