import { nanoid } from 'nanoid';
import { MainKVServices } from '../types/nats.mjs';
import { hostname } from 'node:os';
import { createHash } from 'node:crypto';

export async function createInfoService(services: MainKVServices) {
    let clusterId = nanoid();

    try {
        await services.mainKV.create('clusterId', nanoid());
    } catch {
        const storedClusterId = (await services.mainKV.get('clusterId'))?.string();

        if (!storedClusterId) {
            throw new Error('clusterId does not exist');
        }

        clusterId = storedClusterId;
    }

    const hashedHostname = createHash('sha256').update(hostname()).digest('hex');

    return {
        runId: nanoid(),
        clusterId: clusterId,
        hashedHostname: hashedHostname,
    };
}

export type TInfoService = {
    info: Awaited<ReturnType<typeof createInfoService>>;
};
