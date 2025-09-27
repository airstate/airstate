import { hookRegistry, globalHookUrl } from './registry.mjs';
import type { HookPayloads, HookResponsePayloads } from '../types/hook.mjs';
import { logger } from '../logger.mjs';
import { TRPCError } from '@trpc/server';
export async function dispatchHook<H extends keyof HookPayloads>(
    hookName: H,
    payload: HookPayloads[H],
): Promise<HookResponsePayloads[H]> {
    const specificUrl = hookRegistry[hookName];
    const urlToCall = specificUrl || globalHookUrl;

    if (!urlToCall) {
        logger.warn(`No hook URL configured for hook "${hookName}"`);
        return {} as HookResponsePayloads[H];
    }

    try {
        const res = await fetch(urlToCall, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });

        if (!res.ok) {
            logger.error(`Hook call to ${urlToCall} failed with status ${res.status}`);
            throw new Error(`Hook call failed for ${hookName} with status ${res.status}`);
        }

        const data = await res.json();
        return data as HookResponsePayloads[H];
    } catch (error) {
        logger.error(`Error calling hook "${hookName}": ${error}`);
        throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: `Hook "${hookName}" failed with error: ${error}`,
        });
    }
}
