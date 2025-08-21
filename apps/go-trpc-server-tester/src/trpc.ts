import type { TServerRouter } from '@airstate/go-server-types';
import { createTRPCReact } from '@trpc/react-query';

export const trpc = createTRPCReact<TServerRouter>();
