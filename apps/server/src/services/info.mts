import { nanoid } from 'nanoid';

export async function createInfoService() {
    return {
        runID: nanoid(),
    };
}

export type TInfoService = {
    info: Awaited<ReturnType<typeof createInfoService>>;
};
