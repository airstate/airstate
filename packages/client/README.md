# @airstate/client

A set of powerful and opensource primitives for JavaScript that
help you build any kind of real-time collaboration features
into your webapps.

## Installation

```bash
pnpm add @airstate/client

# or
npm install --save @airstate/client
```

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

## SharedState

Every client at the same URL path will see the
same data, and can update this data for it to be synced in
real-time to all clients.

Ideal for building: shared lists, graphics editing tools,
media remotes.

```html
<button id="b">OFF - Click to Toggle</button>
```

```ts
import { sharedState } from '@airstate/client';

const button = document.getElementById('b')!;

const state = sharedState<boolean>({
    initialValue: false
});

state.onUpdate((value) => {
    button.innerHTML = `${value ? 'ON' : 'OFF'} - Click to Toggle`;
});

button.addEventListener('click', () => {
    state.update((prev) => !prev);
});
```

### SharedState: Kitchen Sink Example

```ts
const state = sharedState<TOptionalSharedStateType>({

    initialValue: { tomato: 'reddish' }, // the initial state
    key: 'a-specific-room-key',          // if you don't want airstate to infer from url
    token: 'jwt-signed-by-your-server',  // to maintain authentication & authorization
    client: customClient                 // if you don't want to use the default client

});

state.onSynced(() => {
    /* ideally, start making updates after this event */
});

state.onUpdate((nextState) => {
    /* do what you want with this */
});

state.onConnect(() => {
    /* connection established */
});

state.onDisconnect(() => {
    /* connection lost */
});

state.onError((error) => {
    /* something went wrong */
});

state.update({ tomato: 'sometimes green' });                                  // set the state to this value for every client
state.update((prev) => ({ ...prev, tomato: 'sometimes green' }));  // functional updates

state.synced;    // a boolean which contains if the first sync has occurred or not
state.destroy(); // destroys the state instance and reclaims all memory
```

[Read The Docs](https://airstate.dev/docs/latest/client/javascript/shared-state/usage) for more details on `sharedState`
and its options.

## SharedPresence

Use this to build things like avatar stacks, live cursors,
or location sharing. Use cases where allowing everyone to edit everyone's
data doesn't make sense.

By default, every client at the same URL can see each other's data,
but each client can only update their own data.

Here is an example to build real-time cursors:

```html
<div
    class="absolute top-0 left-0 w-72 h-72 bg-blue-200"
    id="container"
>
    <!-- will add individual cursors here -->
</div>
```

```ts
import { sharedPresence } from '@airstate/client';

const presence = sharedPresence({
    roomKey: window.location.search,
    peerKey: `${Math.random()}`,
    initialDynamicState: {
        x: 0,
        y: 0
    }
});

const container = document.getElementById('container')!;

presence.onUpdate((tomato) => {
    for (const [peerKey, other] of Object.entries(presence.others)) {
        let targetDiv = document.getElementById(peerKey);

        if (!targetDiv) {
            targetDiv = document.createElement('div');
            targetDiv.id = peerKey;
            targetDiv.className = 'w-2 h-2 absolute bg-red-500 rounded-full transition-all duration-100';
            container.appendChild(targetDiv);
        }

        targetDiv.style.left = `${other.dynamicState?.state.x ?? 0}px`;
        targetDiv.style.top = `${other.dynamicState?.state.y ?? 0}px`;
    }
});

container.addEventListener('mousemove', (ev) => {
    presence.updateDynamicState({
        x: ev.clientX,
        y: ev.clientY,
    });
});
```

### SharedPresence: Kitchen Sink Example

```ts
const presence = sharedPresence<TOptionalShapeOfDynamicState>({

    roomKey: 'a-specific-room-key',          // if you don't want AirState to infer from URL
    peerKey: 'uniquely-identify-the-client', // yeah, email is fine; session id is also fine
    client: customClient,                    // in case you have more than one client
    token: 'jwt-signed-by-your-server',      // to maintain auth

    initialDynamicState: {                   // the initial dynamic state
        x: 0,
        y: 0,
    },

});

presence.self;   // the latest version of this client's own data
presence.others; // the latest version of every other client's data

presence.updateDynamicState({ x: 1, y: 10 }); // update the client's dynamic state for all other clients to see
presence.updateFocusState(false);   // update the client's focus state

const cleanupUpdateListener = presence.onUpdate((presenceState) => {
    // everytime this client or some other client updates their dynamicState,
    // or focus state, this function gets called.

    presenceState.self;    // the latest version of this client's own data
    presenceState.others;  // the latest version of every other client's data
    presenceState.summary; // a summary of how many clients are active and focused

    presenceState.state;   // an object containing everything above
});

cleanupUpdateListener(); // call the returned function to un-listen

presence.onConnect(() => {
    /* connection established */
});

presence.onDisconnect(() => {
    /* connection lost */
});

presence.onError((error) => {
    /* something went wrong */
});
```

[Read The Docs](https://airstate.dev/docs/latest/client/javascript/shared-state/usage) for more details on `sharedPresence`
and its options.

## License

MIT
