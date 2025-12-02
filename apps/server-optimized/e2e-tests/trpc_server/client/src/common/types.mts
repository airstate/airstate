import { TRPCQueryProcedure, TRPCBuiltRouter, TRPCSubscriptionProcedure, TRPCMutationProcedure } from '@trpc/server';

export type TServerStateMessage =
    | {
          type: 'session-info';
          session_id: string;
      }
    | {
          type: 'init';
      }
    | {
          type: 'updates';
          updates: Array<{
              key: string;
              value: any;
          }>;
      };

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
        serverState: {
            serverState: TRPCSubscriptionProcedure<{
                meta: unknown;
                input: {};
                output: TServerStateMessage;
            }>;
            watchKeys: TRPCMutationProcedure<{
                meta: unknown;
                input: {
                    appId: string;
                    sessionId: string;
                    keys: string[];
                };
                output: Record<
                    string,
                    {
                        key: string;
                        value: any;
                    }
                >;
            }>;
        };
    }
>;
