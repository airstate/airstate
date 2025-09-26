# @airstate/react

A set of powerful and opensource hooks for React that help you build any kind 
of real-time collaboration experiences.

## Quick Links

- [DOCS AirState React SDK](https://airstate.dev/docs/latest/react/install)
- [AirState Cloud](https://console.airstate.dev/)

# Quickstart

## Install

```bash
pnpm add @airstate/client @airstate/react

# or
npm install --save @airstate/client @airstate/react
```

Note: [`@airstate/client`](https://www.npmjs.com/package/@airstate/client) is a required peer dependency of the 
React SDK

## Configure

Get your `appId` from [console.airstate.dev](https://console.airstate.dev)

```ts
import { configure } from '@airstate/client';

// Call this before you start using the hooks
// (it's safe to call outside react components)

configure({
    appId: '[your app id]',
});
```

## SharedState — `useSharedState`

This is a drop-in replacement for React's `useState`.

Every client at the same URL path will see the
same data, and can update this data for it to be synced in
real-time to all clients.

```tsx
// assume curent page url: example.com/tomato

import {useSharedState} from '@airstate/react';

export function App() {
    // every client on example.com/tomato will see the
    // save value in `state`
    const [state, setState] = useSharedState<boolean>(false);

    const toggle = () => {
        setState((prev) => !prev);
    };

    return (
        <button onClick={toggle}>
            {state ? 'ON' : 'OFF'} - Click to Toggle
        </button>
    );
}
```

[Read The Docs](https://airstate.dev/docs/latest/react/shared-state/usage) for more details on `useSharedState`
and its options.

## SharedPresence — `useSharedPresence`

Use this to build things like avatar stacks, live cursors,
or location sharing. Use cases where allowing everyone to edit everyone's
data doesn't make sense.

By default, every client at the same URL can see each other's data,
but each client can only update their own data.

Here is an example to build real-time cursors:


```tsx
// assume current page url: example.com/tomato

import { useSharedPresence, usePersistentNanoId } from '@airstate/react';

export function App() {
    const peerId = usePersistentNanoId();

    // every client on example.com/tomato is now part of the same room
    // and is sharing their state in real-time

    const { others, setState } = useSharedPresence({
        peer: peerId, // replace this with any string that uniquely identifies the user
        initialState: {
            x: 0,
            y: 0,
        },
    });

    return (
        // a blue 512 x 512 square
        <div
            className={'absolute bg-blue-200 top-0 left-0 w-[512] h-[512]'}
            onMouseMove={(ev) => {
                // update dynamic state on mouse move
                setState({
                    x: ev.clientX,
                    y: ev.clientY,
                });
            }}>
            {/* other people's cursors */}
            {Object.values(others).map((other) => (
                <div
                    className={'absolute bg-red-500 w-[2] h-[2] rounded-full'}
                    style={{
                        left: other.state.x - 1,
                        top: other.state.y - 1,
                    }}></div>
            ))}
        </div>
    );
}
```


[Read The Docs](https://airstate.dev/docs/latest/react/shared-presence/usage) for more details on `useSharedPresence`
and its options.

## License

MIT
