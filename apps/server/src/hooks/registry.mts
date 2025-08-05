import { env } from '../env.mjs';

export const hookRegistry = {
    clientConnected: env.HOOK_URL_CLIENT_CONNECTED || null,
    clientDisconnected: env.HOOK_URL_CLIENT_DISCONNECTED || null,
    clientSubscribed: env.HOOK_URL_CLIENT_SUBSCRIBED || null,
    clientUnsubscribed: env.HOOK_URL_CLIENT_UNSUBSCRIBED || null,
    roomCreated: env.HOOK_URL_ROOM_CREATED || null,
    documentCreated: env.HOOK_URL_DOCUMENT_CREATED || null,
} as const;

export const globalHookUrl = env.HOOK_URL_GLOBAL || null;
