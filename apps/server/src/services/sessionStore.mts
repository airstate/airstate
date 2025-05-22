import { makeAutoObservable } from 'mobx';
import { TPermissions } from '../schema/config.mjs';

interface SessionData {
    token: string | null;
    permissions: TPermissions;
}

const createSessionStore = () => {
    const store = {
        sessions: new Map<string, SessionData | null>(),

        setSessionData(sessionId: string, data: SessionData | null) {
            this.sessions.set(sessionId, data);
        },
        getSessionData(sessionId: string): SessionData | null | undefined {
            return this.sessions.get(sessionId);
        },
        removeSession(sessionId: string) {
            this.sessions.delete(sessionId);
        },
    };
    makeAutoObservable(store);

    return store;
};

export const sessionStore = createSessionStore();
