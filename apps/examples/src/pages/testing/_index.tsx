import React from 'react';
import { useSharedState, configure, useSharedPresence } from '@airstate/react';
import { z } from 'astro/zod';

configure({
    server: 'ws://localhost:11001/ws',
});

const usp = new URLSearchParams(window.location.search);

const id = usp.get('id') ?? 'default';
const peer = usp.get('peer') ?? 'default';

export default function App() {
    const [state, setState, ready] = useSharedState('off', {
        channel: id,
        validate(data) {
            return z.enum(['on', 'off']).parse(data);
        },
    });

    const {
        self,
        others,
        setState: setSelfState,
        stats,
    } = useSharedPresence({
        peerId: peer,
        room: id,
        initialState: [0, 0],
        validate: (raw) => {
            return z.tuple([z.number(), z.number()]).parse(raw);
        },
    });

    return (
        <div className={'p-10'}>
            <div className={'border-2 border-black p-10'} onMouseMove={(ev) => setSelfState([ev.clientX, ev.clientY])}>
                {peer}: {self.state[0]}, {self.state[1]}
                <br />
                <input
                    type={'checkbox'}
                    checked={state === 'on'}
                    onChange={(ev) => setState(ev.target.checked ? 'on' : 'off')}
                />
                <br />
                {Object.values(others).map((other) => {
                    return (
                        <div key={other.peerId}>
                            {other.peerId}: {other.state[0]}, {other.state[1]}
                        </div>
                    );
                })}
                <br />
                <br />
                {stats.totalPeers}
            </div>
        </div>
    );
}
