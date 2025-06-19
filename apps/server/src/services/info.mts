import { nanoid } from 'nanoid';
import { MainKVServices } from '../types/nats.mjs';
import { hostname } from 'node:os';
import { createHash } from 'node:crypto';

export async function createInfoService(services: MainKVServices) {
    let clusterID = nanoid();

    try {
        await services.mainKV.create('clusterID', nanoid());
    } catch {
        const storedClusterID = (await services.mainKV.get('clusterID'))?.string();

        if (!storedClusterID) {
            throw new Error('clusterID does not exist');
        }

        clusterID = storedClusterID;
    }

    const hashedHostname = createHash('sha256').update(hostname()).digest('hex');

    return {
        runID: nanoid(),
        clusterID: clusterID,
        hashedHostname: hashedHostname,
    };
}

export type TInfoService = {
    info: Awaited<ReturnType<typeof createInfoService>>;
};
