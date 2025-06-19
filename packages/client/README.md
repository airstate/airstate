# Airstate Client

A vanilla JS client for managing real-time shared state in your applications. Built on top of Yjs, Airstate provides a simple yet powerful API for creating and managing collaborative state across multiple clients.

## Installation

```bash
npm install @airstate/client
# or
yarn add @airstate/client
# or
pnpm add @airstate/client
```

## Configure

### AirState Cloud

Get your `appKey` from [console.airstate.dev](https://console.airstate.dev)

```typescript
import { configure } from '@airstate/client';

// Call this before your app starts
configure({
    appKey: '[your app key]',
});
```

### Self Hosted

```typescript
import { configure } from '@airstate/client';

// Call this before your app starts
configure({
    server: 'https://[your-server-hostname]:[port]/airstate',
});
```

## Core Concepts

### Shared State

The `createSharedState` function is the main entry point for creating shared state in your application. It provides a simple API for managing state that automatically syncs across all connected clients.

```typescript
import { createSharedState } from '@airstate/client';

// Create a shared state
const sharedState = createSharedState({
    key: 'my-room', // Unique identifier for the room where state is shared
    initialValue: { count: 0 }, // Optional initial value
    token: 'your-auth-token', // Optional authentication token
});

// Update the state
sharedState.update({ count: 1 });

// Listen for updates
const unsubscribe = sharedState.onUpdate((newValue) => {
    console.log('State updated:', newValue);
});

// Listen for first sync
sharedState.onSynced((value) => {
    console.log('State synced:', value);
});
```

### Shared YDoc

For more advanced use cases, you can use the `sharedYDoc` function to work directly with Yjs documents. This gives you access to the full power of Yjs CRDTs.

```typescript
import { sharedYDoc } from '@airstate/client';
import * as y from 'yjs';

// Create a Yjs document
const doc = new y.Doc();

// Create a shared document
const sharedDoc = sharedYDoc({
    doc,
    key: 'my-room', // Unique identifier for the room where document is shared
    token: 'your-auth-token', // Optional
});

// Handle initialization
sharedDoc.onInit((doc, { hasWrittenFirstUpdate }) => {
    if (!hasWrittenFirstUpdate) {
        // This is the first client in the room
        console.log('First client in room');
    }
});

// Handle sync events
sharedDoc.onSynced((doc) => {
    console.log('Document fully synced');

    // Now safe to make updates
    y.transact(doc, () => {
        const map = doc.getMap('data');
        map.set('key', 'value');
    });
});
```

## API Reference

### createSharedState

Creates a new shared state instance.

```typescript
function createSharedState<T extends TJSONAble>(options: {
    key: string;
    client?: TAirStateClient;
    token?: string | (() => string | Promise<string>);
    initialValue?: T | (() => T);
}): TSharedStateReturn<T>;
```

#### Options

- `key`: Unique identifier for the room where state is shared
- `client`: Optional custom TRPC client instance
- `token`: Optional authentication token or function that returns a token
- `initialValue`: Optional initial state value or function that returns initial state

#### Return Value

Returns an object with the following methods:

- `update(value | function)`: Updates the shared state. Can accept either a new value directly or a function that receives the previous value and returns the new value. The function form is useful for atomic updates based on the current state.

<details>
<summary>Example</summary>

```typescript
// Direct value update
state.update({ count: 5 });

// Function update
state.update((prev) => ({
    ...prev,
    count: prev.count + 1,
}));
```

</details>

- `onUpdate(listener)`: Subscribes to state updates. The listener receives the new value whenever the state changes. Returns a function to unsubscribe.

<details>
<summary>Example</summary>

```typescript
const unsubscribe = state.onUpdate((newValue) => {
    console.log('State changed:', newValue);
});
// Later...
unsubscribe();
```

</details>

- `onSynced(listener)`: Subscribes to sync events. The listener is called when the state is fully synchronized with the server. This is the right time to make initial updates. Returns a function to unsubscribe.

<details>
<summary>Example</summary>

```typescript
const unsubscribe = state.onSynced((value) => {
    console.log('State synced:', value);
    // Safe to make initial updates here
    state.update({ initialized: true });
});
```

</details>

- `onError(listener)`: Subscribes to error events. The listener receives any errors that occur during state synchronization or updates. Returns a function to unsubscribe.

<details>
<summary>Example</summary>

```typescript
const unsubscribe = state.onError((error) => {
    console.error('State error:', error);
    // Handle error, maybe retry connection
});
```

</details>

- `onConnect(listener)`: Subscribes to connection events. The listener is called when the connection to the room is established. Returns a function to unsubscribe.

<details>
<summary>Example</summary>

```typescript
const unsubscribe = state.onConnect(() => {
    console.log('Connected to room');
    // Maybe refresh state or show online status
});
```

</details>

- `onDisconnect(listener)`: Subscribes to disconnection events. The listener is called when the connection to the room is lost. Returns a function to unsubscribe.

<details>
<summary>Example</summary>

```typescript
const unsubscribe = state.onDisconnect(() => {
    console.log('Disconnected from room');
    // Maybe show offline status or retry connection
});
```

</details>

- `destroy()`: Cleans up all resources and unsubscribes from all events. Should be called when the shared state is no longer needed.

<details>
<summary>Example</summary>

```typescript
// When component unmounts or state is no longer needed
state.destroy();
```

</details>

- `synced`: A boolean property indicating whether the state is currently synchronized with the server. Useful for checking if it's safe to make updates.

<details>
<summary>Example</summary>

```typescript
if (state.synced) {
    // Safe to make updates
    state.update({ count: 5 });
} else {
    console.log('Waiting for sync...');
}
```

</details>

### sharedYDoc

Creates a new shared Yjs document instance.

```typescript
function sharedYDoc(options: {
    doc: y.Doc;
    key: string;
    client?: TAirStateClient;
    token?: string | (() => string | Promise<string>);
}): TSharedYDoc;
```

#### Options

- `doc`: Yjs document instance
- `key`: Unique identifier for the room where document is shared
- `client`: Optional custom TRPC client instance
- `token`: Optional authentication token or function that returns a token

#### Return Value

Returns an object with the following methods:

- `onError(listener)`: Subscribes to error events. The listener receives any errors that occur during document synchronization or updates. Returns a function to unsubscribe.

<details>
<summary>Example</summary>

```typescript
const unsubscribe = shared.onError((error) => {
    console.error('Document error:', error);
    // Handle error, maybe retry connection
});
```

</details>

- `onConnect(listener)`: Subscribes to connection events. The listener is called when the connection to the room is established. Returns a function to unsubscribe.

<details>
<summary>Example</summary>

```typescript
const unsubscribe = shared.onConnect(() => {
    console.log('Connected to room');
    // Maybe refresh document or show online status
});
```

</details>

- `onDisconnect(listener)`: Subscribes to disconnection events. The listener is called when the connection to the room is lost. Returns a function to unsubscribe.

<details>
<summary>Example</summary>

```typescript
const unsubscribe = shared.onDisconnect(() => {
    console.log('Disconnected from room');
    // Maybe show offline status or retry connection
});
```

</details>

- `onSynced(listener)`: Subscribes to sync events. The listener receives the Yjs document when it's fully synchronized with the server. This is the right time to make initial updates. Returns a function to unsubscribe.

<details>
<summary>Example</summary>

```typescript
const unsubscribe = shared.onSynced((doc) => {
    console.log('Document synced');
    // Safe to make initial updates
    y.transact(doc, () => {
        const map = doc.getMap('data');
        map.set('initialized', true);
    });
});
```

</details>

- `onInit(listener)`: Subscribes to initialization events. The listener receives the Yjs document and metadata about whether this is the first client in the room. Useful for setting up initial document structure. Returns a function to unsubscribe.

<details>
<summary>Example</summary>

```typescript
const unsubscribe = shared.onInit((doc, { hasWrittenFirstUpdate }) => {
    if (!hasWrittenFirstUpdate) {
        // First client in room, set up initial structure
        y.transact(doc, () => {
            const map = doc.getMap('data');
            map.set('createdAt', new Date().toISOString());
            map.set('version', '1.0.0');
        });
    }
});
```

</details>

- `destroy()`: Cleans up all resources and unsubscribes from all events. Should be called when the shared document is no longer needed.

<details>
<summary>Example</summary>

```typescript
// When component unmounts or document is no longer needed
shared.destroy();
```

</details>

- `filterUpdates(filterFunc)`: Allows filtering of updates before they are sent to the server. The filter function receives an array of [update, origin] pairs and should return the filtered array. Useful for implementing custom update policies or preventing certain updates from being sent.

<details>
<summary>Example</summary>

```typescript
shared.filterUpdates((updates) => {
    // Only allow updates from specific origins
    return updates.filter(([update, origin]) => {
        return origin === 'user' || origin === 'system';
    });
});
```

</details>

## License

MIT
