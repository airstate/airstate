import { useReducer } from 'react';

export function useForceUpdate() {
    const [, forceUpdate] = useReducer((x) => (x + 1) % Number.MAX_SAFE_INTEGER, 0);
    return forceUpdate;
}