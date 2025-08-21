import { initTRPC } from '@trpc/server';
import { z } from 'zod';

const t = initTRPC.create();

export const r = t.router;
export const p = t.procedure;

const serverRouter = r({
    echo: r({
        run: p.input(z.any()).query(() => {
            return null as any;
        })
    }),
    uppercase: p.input(z.string()).mutation(() => {
        return null as any;
    })
});

export type TServerRouter = typeof serverRouter;
