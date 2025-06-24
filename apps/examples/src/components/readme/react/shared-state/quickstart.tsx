import { useSharedState } from '@airstate/react';
import { useState } from 'react';

export function ReactReadmeSharedStateQuickStart() {
    // every client on example.com/tomato will see the
    // save value in state
    const [state, setState] = useSharedState<boolean>(false);

    const toggle = () => {
        setState((prev) => !prev);
    };

    return <button onClick={toggle}>{state ? 'ON' : 'OFF'} - Click to Toggle</button>;
}
