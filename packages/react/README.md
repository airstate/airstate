# @airstate/react

A set of powerful and opensource hooks for React that help you build any kind 
of real-time collaboration experiences.

## Quick Links

- [DOCS AirState React SDK](https://airstate.dev/docs/latest/client/react/intro)
- [AirState Cloud](https://console.airstate.dev/)
- [Self Hosting Instruction](https://airstate.dev/docs/latest/self-hosting)

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

Get your `appKey` from [console.airstate.dev](https://console.airstate.dev)

```ts
import { configure } from '@airstate/client';

// Call this before you start using the hooks
// (it's safe to call outside react components)

configure({
    appKey: '[your app key]',
});
```

If you want to connect to a self-hosted opensource version of our AirState server,
please consult the [docs on self-hosting](https://airstate.dev/docs/latest/self-host/connect)

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

### `useSharedState` Kitchen Sink Example

Here's an example of using the hook with all the options and returns
displayed.

```tsx
export function App() {
    const [
        
        state,     // the data everyone sees
        setState,  // change the data everyone sees
        isReady,   // if the first-sync has occurred or not
        
    ] = useSharedState<TOptionalTypeOfState>(

        { potato: 'brownish' },     // the initial state
        
        {
            key: 'a-specific-room-key',          // if you don't want airstate to infer from url
            token: 'jwt-signed-by-your-server',  // to maintain authentication & authorization
            client: customClient                 // if you don't want to use the default client
        }
    );

    return <>{/* ... */}</>;
}
```

[Read The Docs](https://airstate.dev/docs/latest/client/react/shared-state/usage) for more details on `useSharedState` 
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

import { useSharedPresence } from '@airstate/react';

export function App() {
    // every client on example.com/tomato is now part of the same room
    // and is sharing their dynamic state in real-time
    
    const { others, setDynamicState } = useSharedPresence({
        peerKey: `${Math.random()}`, // replace this with any string that uniquely identifies the user
        initialDynamicState: {
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
                setDynamicState({
                    x: ev.clientX,
                    y: ev.clientY,
                });
            }}>
            {/* other people's cursors */}
            {Object.values(others).map((other) => (
                <div
                    className={'absolute bg-red-500 w-[2] h-[2] rounded-full'}
                    style={{
                        top: (other.dynamicState?.state.y ?? 0) - 1,
                        left: (other.dynamicState?.state.x ?? 0) - 1,
                    }}></div>
            ))}
        </div>
    );
}
```

### `useSharedPresence` Kitchen Sink Example
Here's a example of using the hook with all the return keys and options

```tsx
export function MaxedOut() {
    const {
        
        self,              // this client's data
        setDynamicState,   // set this client's dynamic state
        others,            // everyone else's data (but not this client's)
        summary,           // the number of peers that are online and focused
        setFocus,          // set if this client is currently on the page and active
    
    } = useSharedPresence<TOptionalTypeOfDynamicState>({
        
        peerKey: `email-or-something-idk`,  // any string that uniquely identifies the user.
        roomKey: 'a-specific-room-key',     // if you don't want airstate to infer from url
        token: 'jwt-signed-by-your-server', // to maintain authentication & authorization
        client: customClient,               // if you don't use to use the default client with default config
       
        initialDynamicState: {
            x: 0,
            y: 0,
        },
        
    });

    return <>{/* ... */}</>
}
```

[Read The Docs](https://airstate.dev/docs/latest/client/react/shared-presence/usage) for more details on `useSharedPresence`
and its options.

## License

MIT
