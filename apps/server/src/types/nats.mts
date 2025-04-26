import { Codec, JetStreamClient, JetStreamManager, KV, NatsConnection } from 'nats';

export type NatsUtilServices = {
    natsStringCodec: Codec<string>;
};

export type JetStreamServices = {
    jetStreamClient: JetStreamClient;
    jetStreamManager: JetStreamManager;
};

export type SharedStateKVServices = {
    sharedStateKV: KV;
};

export type KVServices = SharedStateKVServices & {};

export type NATSServices = {
    natsConnection: NatsConnection;
} & NatsUtilServices &
    JetStreamServices &
    KVServices;
