import { nanoid } from 'nanoid';

export function usePersistentNanoId(key?: string) {
    if (typeof window !== 'undefined' && window.localStorage) {
        const storageKey = `airstate-persistent-nanoid-${key ?? '_default'}`;
        const stored = window.localStorage.getItem(storageKey);

        if (stored) {
            return stored;
        } else {
            const id = nanoid();
            window.localStorage.setItem(storageKey, id);

            return id;
        }
    } else {
        return nanoid();
    }
}
