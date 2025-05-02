import { nanoid } from 'nanoid';

export async function createInfoService() {
    return {
        ephemeral_id: nanoid(),
    };
}

export type TInfoService = {
    info: Awaited<ReturnType<typeof createInfoService>>;
};
