# @airstate/use-shared-state

A drop-in replacement for React's `useState` for developers who want to build realtime React apps.
`useSharedState` automatically syncs state across different clients in real-time.

> [BETA] This program is still in beta, and is it active development. Refrain from using it in production
> as the API is as of yet, unstable.

## Installation

```bash
pnpm install --save @airstate/use-shared-state
```

## Configure

### AirState Cloud

Get your `appKey` from [console.airstate.dev](https://console.airstate.dev)

```ts
import { configure } from '@airstate/use-shared-state';

// Call this before your app starts
// (safe to call in SSR outside react tree)

configure({
    appKey: '[your app key]',
});
```

### Self Hosted

```ts
import { configure as configureAirState } from '@airstate/use-shared-state';

// Call this before your app starts
// (safe to call in SSR outside react tree)

configureAirState({
    server: 'https://[your-server-hostname]:[port]/airstate',
});
```

## Telemetry

By default AirState gathers information about the framework being used only in localhost.
This allows us to build better software to help the community.

Note: no identifying information is sent to our servers.

```ts
configureAirState({
    // ...
    disableDevelopmentTelemetry: false, // or `true`
    // ...
});
```

## License

MIT
