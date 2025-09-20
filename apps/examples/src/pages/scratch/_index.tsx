import { configure } from '@airstate/client';
import { useServerState } from '@airstate/react';

import { Awareness } from 'y-protocols/awareness';
import { QuillBinding } from 'y-quill';

const aware = new Awareness();

new QuillBinding(null as any, null as any, aware);

configure({
    server: `ws://localhost:11001/ws`,
});

export function Scratch() {
    const [state, { error }] = useServerState('server-state-b');

    return (
        <div>
            <pre>state: {JSON.stringify(state ?? null, null, 2)}</pre>
            <pre>error: {JSON.stringify(error ?? null, null, 2)}</pre>
        </div>
    );
}
