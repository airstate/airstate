# @airstate/client

A set of powerful and opensource primitives for JavaScript that
help you build any kind of real-time collaboration features
into your webapps.

## Quick Links

- [AirState Docs](https://airstate.dev/docs/latest)
- [AirState Cloud](https://console.airstate.dev/)


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
    appId: '[your app key]',
});
```

## Note

AirState's JS SDK Documentation is still under construction. We recommend using SDK
via the React SDK instead until JS SDK API stabilizes.

[AirState Docs](https://airstate.dev/docs/latest)

## License

MIT
