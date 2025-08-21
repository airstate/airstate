import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createWSClient, wsLink } from '@trpc/client';
import { useState } from 'react';
import { trpc } from './trpc';

export function App() {
  const { data: echod } = trpc.echo.run.useQuery({
    message: "Hello World"
  });

  const { data: uppered, mutate } = trpc.uppercase.useMutation();

  return (
    <div>
      <button onClick={() => mutate('Omran Jamal')}>run</button>
      <pre>{JSON.stringify(echod)}</pre>
      <pre>{JSON.stringify(uppered)}</pre>
    </div>
  );
}

export function Root() {
  const [queryClient] = useState(() => new QueryClient());
  const [wsClient] = useState(() => createWSClient({
    url: 'ws://localhost:8080/ws'
  }));

  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [
        wsLink({
          client: wsClient
        }),
      ],
    }),
  );

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </trpc.Provider>
  );
}