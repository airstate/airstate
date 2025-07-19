import React, { useId, useState } from 'react';
import { useSharedState, configure, useSharedPresence } from '@airstate/react';
import { nanoid } from 'nanoid';

configure({
    server: 'ws://localhost:11001/ws',
});

const usp = new URLSearchParams(window.location.search);

const id = usp.get('id') ?? 'default';
const peer = usp.get('peer') ?? 'default';

export default function App() {
    const [state, setState] = useSharedState<{ tomato: boolean }>(
        {
            tomato: false,
        },
        {
            channel: id,
        },
    );

    const {
        self,
        others,
        setState: setSelfState,
        stats,
    } = useSharedPresence({
        peerId: peer,
        room: id,
        initialState: [0, 0],
    });

    return (
        <div className={'p-10'}>
            <div className={'border-2 border-black p-10'} onMouseMove={(ev) => setSelfState([ev.clientX, ev.clientY])}>
                {peer}: {self.state[0]}, {self.state[1]}
                <br />
                <input
                    type={'checkbox'}
                    checked={state.tomato}
                    onChange={(ev) =>
                        setState({
                            tomato: ev.target.checked,
                        })
                    }
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
