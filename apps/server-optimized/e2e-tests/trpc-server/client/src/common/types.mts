import { TRPCQueryProcedure, TRPCBuiltRouter, TRPCSubscriptionProcedure } from '@trpc/server';

export type TRouter = TRPCBuiltRouter<
    any,
    {
        _: TRPCQueryProcedure<{
            meta: unknown;
            input: void;
            output: {
                message: string;
                time: string;
            };
        }>;
        seconds: TRPCSubscriptionProcedure<{
            meta: unknown;
            input: void;
            output: {
                unix: number;
            };
        }>;
    }
>;
